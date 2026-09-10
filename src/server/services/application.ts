import { randomBytes, createHash } from "node:crypto";
import type {
  ApplicantProfile,
  ApplicationSnapshot,
  BankCheckResult,
  BureauResult,
  EmploymentType,
  HousingStatus,
  LoanPurpose,
} from "../../domain/application/types";
import {
  checkTransition,
  type Actor,
  type ApplicationState,
} from "../../domain/application/states";
import type { CurrencyCode } from "../../domain/finance/money";
import { recordAudit } from "../audit";
import { PRODUCT } from "../config";
import { db } from "../db";
import { fromJson } from "../json";

export class StateConflictError extends Error {
  constructor(
    public readonly from: ApplicationState,
    public readonly to: ApplicationState,
    public readonly reason: string,
  ) {
    super(`Cannot move application from ${from} to ${to}: ${reason}`);
    this.name = "StateConflictError";
  }
}

/**
 * Human-readable reference. Support reads these aloud on the phone, so the
 * alphabet excludes the characters people mishear: no O/0, I/1, S/5.
 */
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";

export function generateReference(): string {
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    body += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length];
  }
  return `EK-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function hashResumeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createResumeToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashResumeToken(token) };
}

const EMPTY_APPLICANT: ApplicantProfile = {
  firstName: "",
  lastName: "",
  birthDate: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: PRODUCT.country,
  residentSinceMonths: 0,
  employmentType: "PERMANENT",
  employerName: null,
  employedSinceMonths: 0,
  employmentEndsOn: null,
  netMonthlyIncome: 0,
  otherMonthlyIncome: 0,
};

export interface CreateApplicationInput {
  amount: number;
  termMonths: number;
  purpose: LoanPurpose;
  locale: string;
  userId?: string | null;
  simulationId?: string | null;
}

export async function createApplication(input: CreateApplicationInput) {
  const { token, hash } = createResumeToken();
  const application = await db.application.create({
    data: {
      reference: generateReference(),
      userId: input.userId ?? null,
      amount: input.amount,
      termMonths: input.termMonths,
      purpose: input.purpose,
      locale: input.locale,
      country: PRODUCT.country,
      currency: PRODUCT.currency,
      resumeTokenHash: hash,
      expiresAt: new Date(Date.now() + PRODUCT.draftTtlDays * 86_400_000),
      household: { create: {} },
    },
  });

  if (input.simulationId) {
    await db.simulation.update({
      where: { id: input.simulationId },
      data: { applicationId: application.id },
    });
  }

  await recordAudit({
    applicationId: application.id,
    action: "application_created",
    actorType: input.userId ? "CUSTOMER" : "SYSTEM",
    actorId: input.userId ?? null,
    payload: {
      reference: application.reference,
      amount: input.amount,
      termMonths: input.termMonths,
      purpose: input.purpose,
      fromSimulation: Boolean(input.simulationId),
    },
  });

  return { application, resumeToken: token };
}

/**
 * Moves an application to a new state.
 *
 * Re-entering the current state succeeds without writing anything, so a
 * double-submitted form or a replayed webhook is harmless. Any other
 * disallowed move raises rather than being silently ignored: a funnel that
 * quietly skips a step is worse than one that errors.
 */
export async function transition(
  applicationId: string,
  to: ApplicationState,
  actor: Actor,
  options: { actorId?: string | null; reason?: string; payload?: Record<string, unknown> } = {},
): Promise<ApplicationState> {
  const current = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { state: true },
  });
  const from = current.state as ApplicationState;

  const check = checkTransition(from, to, actor);
  if (!check.ok) throw new StateConflictError(from, to, check.reason);
  if (check.noop) return from;

  await db.application.update({
    where: { id: applicationId },
    data: {
      state: to,
      ...(to === "SUBMITTED" ? { submittedAt: new Date() } : {}),
      ...(to === "APPROVED" || to === "DECLINED" ? { decidedAt: new Date() } : {}),
    },
  });

  await recordAudit({
    applicationId,
    action: "state_changed",
    actorType: actor,
    actorId: options.actorId ?? null,
    payload: { from, to, reason: options.reason ?? null, ...(options.payload ?? {}) },
  });

  return to;
}

const NO_BUREAU: BureauResult = {
  status: "PENDING",
  score: null,
  negativeItems: null,
  thinFile: false,
  enquiryType: "NEUTRAL",
  checkedAt: null,
};

const NO_BANK_CHECK: BankCheckResult = {
  status: "NOT_STARTED",
  verifiedNetMonthlyIncome: null,
  overdraftDays: null,
  returnedDirectDebits: null,
  detectedLoanInstalments: null,
  observationMonths: null,
  completedAt: null,
};

/**
 * Assembles the decision input from the stored rows.
 *
 * Only the most recent bureau and account check count: an application that was
 * re-run after the borrower corrected their income must be decided on the new
 * figures, never on a stale row that happens to sort first.
 */
export async function loadSnapshot(applicationId: string): Promise<ApplicationSnapshot> {
  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      applicants: true,
      household: true,
      bureauChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
      bankChecks: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  const toProfile = (row: (typeof application.applicants)[number]): ApplicantProfile => ({
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate,
    email: row.email,
    phone: row.phone,
    street: row.street,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    residentSinceMonths: row.residentSinceMonths,
    employmentType: row.employmentType as EmploymentType,
    employerName: row.employerName,
    employedSinceMonths: row.employedSinceMonths,
    employmentEndsOn: row.employmentEndsOn,
    netMonthlyIncome: row.netMonthlyIncome,
    otherMonthlyIncome: row.otherMonthlyIncome,
  });

  const primary = application.applicants.find((row) => row.role === "PRIMARY");
  const co = application.applicants.find((row) => row.role === "CO_BORROWER");
  const bureauRow = application.bureauChecks[0];
  const bankRow = application.bankChecks[0];

  return {
    applicant: primary ? toProfile(primary) : EMPTY_APPLICANT,
    coApplicant: co ? toProfile(co) : null,
    household: {
      adults: application.household?.adults ?? 1,
      children: application.household?.children ?? 0,
      housingStatus: (application.household?.housingStatus ?? "RENT") as HousingStatus,
      monthlyHousingCost: application.household?.monthlyHousingCost ?? 0,
      existingLoanInstalments: application.household?.existingLoanInstalments ?? 0,
      otherFixedCosts: application.household?.otherFixedCosts ?? 0,
    },
    request: {
      amount: application.amount,
      termMonths: application.termMonths,
      purpose: application.purpose as LoanPurpose,
      currency: application.currency as CurrencyCode,
    },
    bureau: bureauRow
      ? {
          status: bureauRow.status as BureauResult["status"],
          score: bureauRow.score,
          negativeItems: bureauRow.negativeItems,
          thinFile: bureauRow.thinFile,
          enquiryType: bureauRow.enquiryType as BureauResult["enquiryType"],
          checkedAt: bureauRow.checkedAt.toISOString(),
        }
      : NO_BUREAU,
    bankCheck: bankRow
      ? fromJson<BankCheckResult>(bankRow.resultJson, {
          ...NO_BANK_CHECK,
          status: bankRow.status as BankCheckResult["status"],
        })
      : NO_BANK_CHECK,
  };
}
