import type { ApplicationState } from "../../domain/application/states";
import type { Decision, FiredRule } from "../../domain/rules/types";
import type { Facts } from "../../domain/rules/conditions";
import { recordAudit } from "../audit";
import { SLA } from "../config";
import { db } from "../db";
import { fromJson } from "../json";
import { transition } from "./application";
import { generateContract } from "./contract";
import { documentsFor, requiredDocuments } from "./documents";
import { notify } from "./notifications";
import { deleteStored } from "../storage";
import type { Locale } from "../../i18n";

/**
 * Required document kinds that are not yet validated.
 *
 * Returned as kinds rather than a boolean so the interface can say *which*
 * ones an agent still has to review — "the file is incomplete" is not an
 * instruction anyone can act on.
 */
export async function outstandingDocuments(applicationId: string): Promise<string[]> {
  const [required, documents] = await Promise.all([
    requiredDocuments(applicationId),
    documentsFor(applicationId),
  ]);
  return required.filter(
    (kind) =>
      !documents.some(
        (document) =>
          document.kind === kind &&
          document.status === "VALIDATED" &&
          document.replacedById === null,
      ),
  );
}

export interface QueueFilters {
  state?: ApplicationState;
  outcome?: "ACCEPT" | "REFER" | "DECLINE";
  query?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The work queue.
 *
 * Referred applications sort first and carry an SLA flag, because the queue's
 * job is to surface the cases a person has to look at, not to list everything
 * that ever happened.
 */
export async function queue(filters: QueueFilters = {}) {
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const page = Math.max(1, filters.page ?? 1);
  const query = filters.query?.trim();

  const rows = await db.application.findMany({
    where: {
      ...(filters.state ? { state: filters.state } : {}),
      ...(query
        ? {
            OR: [
              { reference: { contains: query } },
              { applicants: { some: { lastName: { contains: query } } } },
              { applicants: { some: { email: { contains: query } } } },
            ],
          }
        : {}),
      ...(filters.outcome
        ? { decisions: { some: { outcome: filters.outcome } } }
        : {}),
    },
    include: {
      applicants: { where: { role: "PRIMARY" }, take: 1 },
      decisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Counted against the same predicate as the rows, not just the state: a
  // filtered list that reports the unfiltered total is a number nobody can
  // reconcile with what is on screen.
  const total = await db.application.count({
    where: {
      ...(filters.state ? { state: filters.state } : {}),
      ...(query
        ? {
            OR: [
              { reference: { contains: query } },
              { applicants: { some: { lastName: { contains: query } } } },
              { applicants: { some: { email: { contains: query } } } },
            ],
          }
        : {}),
      ...(filters.outcome ? { decisions: { some: { outcome: filters.outcome } } } : {}),
    },
  });

  const slaDeadlineMs = SLA.manualDecisionHours * 3_600_000;
  const items = rows.map((row) => {
    const decision = row.decisions[0];
    const needsHuman = decision?.outcome === "REFER" && !decision.overriddenAt;
    return {
      id: row.id,
      reference: row.reference,
      state: row.state as ApplicationState,
      amount: row.amount,
      termMonths: row.termMonths,
      currency: row.currency,
      createdAt: row.createdAt,
      applicantName: row.applicants[0]
        ? `${row.applicants[0].firstName} ${row.applicants[0].lastName}`.trim()
        : "—",
      outcome: decision?.outcome ?? null,
      score: decision?.score ?? null,
      needsHuman,
      slaBreached:
        needsHuman && Date.now() - row.createdAt.getTime() > slaDeadlineMs,
    };
  });

  // Anything waiting on a person comes first, oldest first within that group:
  // a queue sorted purely by recency buries the cases that have waited longest.
  items.sort((a, b) => {
    if (a.needsHuman !== b.needsHuman) return a.needsHuman ? -1 : 1;
    if (a.needsHuman) return a.createdAt.getTime() - b.createdAt.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { items, total, page, pageSize };
}

/**
 * How many applications sit in each state.
 *
 * The queue's job is to answer "what needs me now" before it answers "what
 * exists". A count beside each filter is what turns a list into that answer,
 * and it is one grouped query rather than one per chip.
 */
export async function queueCounts(): Promise<Record<ApplicationState, number>> {
  const rows = await db.application.groupBy({ by: ["state"], _count: { _all: true } });
  const counts = {} as Record<ApplicationState, number>;
  for (const row of rows) counts[row.state as ApplicationState] = row._count._all;
  return counts;
}

export interface DecisionView {
  outcome: Decision["outcome"];
  score: number;
  grade: string | null;
  ruleSetKey: string;
  ruleSetVersion: number;
  firedRules: FiredRule[];
  principalReasons: string[];
  facts: Facts;
  createdAt: Date;
  overriddenBy: string | null;
  overrideOutcome: string | null;
  overrideReason: string | null;
  overriddenAt: Date | null;
}

export async function latestDecision(applicationId: string): Promise<DecisionView | null> {
  const row = await db.decisionRecord.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  return {
    outcome: row.outcome as Decision["outcome"],
    score: row.score,
    grade: row.grade,
    ruleSetKey: row.ruleSetKey,
    ruleSetVersion: row.ruleSetVersion,
    firedRules: fromJson<FiredRule[]>(row.firedRulesJson, []),
    principalReasons: fromJson<string[]>(row.principalReasonsJson, []),
    facts: fromJson<Facts>(row.factsJson, {}),
    createdAt: row.createdAt,
    overriddenBy: row.overriddenBy,
    overrideOutcome: row.overrideOutcome,
    overrideReason: row.overrideReason,
    overriddenAt: row.overriddenAt,
  };
}

/**
 * Approval was attempted on a file whose documents are not all validated.
 *
 * A typed error rather than a message: the back office renders it in the
 * agent's own language, and it names what is missing instead of stating that
 * something is.
 */
export class ReasonRequired extends Error {
  constructor() {
    super("A send-back must state what to correct");
    this.name = "ReasonRequired";
  }
}

/**
 * The decision. This is the only place an application is approved or refused,
 * and only an administrator can call it.
 *
 * Nothing gates it: which documents are in and whether they are any good is
 * what the administrator is looking at when they press the button, and the
 * file records what was outstanding at the time. It generates the contract in
 * the same call — an approved application with no contract is a dead end for
 * the borrower, who has no way to make one appear.
 *
 * `grantedAmount` lets an administrator approve for less than was asked. The
 * contract is generated from the offer, so cutting the amount reprices it.
 */
export async function finaliseDecision(
  applicationId: string,
  input: {
    agentId: string;
    outcome: "APPROVED" | "DECLINED";
    reason?: string;
    grantedAmount?: number | null;
  },
) {
  await transition(applicationId, input.outcome, "AGENT", {
    actorId: input.agentId,
    reason: input.reason,
  });

  if (input.outcome === "APPROVED") {
    if (input.grantedAmount != null) {
      await db.application.update({
        where: { id: applicationId },
        data: { grantedAmount: input.grantedAmount },
      });
    }
    await generateContract(applicationId);
  }

  await recordAudit({
    applicationId,
    action: "credit_decision_final",
    actorType: "AGENT",
    actorId: input.agentId,
    payload: { outcome: input.outcome, reason: input.reason ?? null },
  });

  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { applicants: { where: { role: "PRIMARY" }, take: 1 } },
  });
  const primary = application.applicants[0];
  if (primary) {
    await notify({
      applicationId,
      channel: "EMAIL",
      to: primary.email,
      template: "decision_ready",
      locale: application.locale as Locale,
      variables: { reference: application.reference },
    });
  }
}

/**
 * Sends a submitted file back to the borrower for correction.
 *
 * Distinct from a refusal: the application returns to DRAFT, editable, and the
 * reason is what the borrower is shown. Rejecting a document without this
 * would leave them looking at a file marked "under review" that nobody is
 * going to move.
 */
export async function returnForCorrection(
  applicationId: string,
  input: { agentId: string; reason: string },
) {
  const reason = input.reason.trim();
  if (reason.length < 10) throw new ReasonRequired();

  await transition(applicationId, "DRAFT", "AGENT", { actorId: input.agentId, reason });

  await recordAudit({
    applicationId,
    action: "application_returned",
    actorType: "AGENT",
    actorId: input.agentId,
    payload: { reason },
  });

  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { applicants: { where: { role: "PRIMARY" }, take: 1 } },
  });
  const primary = application.applicants[0];
  if (primary?.email) {
    await notify({
      applicationId,
      channel: "EMAIL",
      to: primary.email,
      template: "documents_required",
      locale: application.locale as Locale,
      variables: { reference: application.reference },
    });
  }
}

/**
 * Erases an application and everything that hangs off it.
 *
 * A real deletion, not a flag: the file, its applicants, household, consents,
 * offers, documents, contracts, decisions, notifications, its loan and that
 * loan's instalments and payments, and the audit trail of the whole thing.
 * Nothing is left to find, which is the point — this is the tool for a test
 * file, a duplicate, or an erasure the borrower asked for.
 *
 * The stored bytes go too, by key, because a document row disappearing while
 * a scan of somebody's passport stays in the store is the opposite of what
 * pressing delete means. Loans, audit entries and stored files are removed by
 * hand: the first two do not cascade on purpose, and the third is not in this
 * database at all when a blob store is connected.
 */
export async function deleteApplication(
  applicationId: string,
  input: { agentId: string },
): Promise<{ reference: string }> {
  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: {
      reference: true,
      documents: { select: { storageKey: true } },
      contracts: {
        select: { storageKey: true, preContractualStorageKey: true, signatureStorageKey: true, signedStorageKey: true },
      },
      loan: { select: { id: true } },
    },
  });

  const keys = [
    ...application.documents.map((row) => row.storageKey),
    ...application.contracts.flatMap((row) => [
      row.storageKey,
      row.preContractualStorageKey,
      row.signatureStorageKey,
      row.signedStorageKey,
    ]),
  ].filter((key): key is string => Boolean(key));

  await db.$transaction(async (tx) => {
    if (application.loan) await tx.loan.delete({ where: { id: application.loan.id } });
    await tx.auditEntry.deleteMany({ where: { applicationId } });
    await tx.application.delete({ where: { id: applicationId } });
  });

  // After the row is gone, so a failure here leaves an orphaned blob rather
  // than a file whose paperwork was destroyed but whose scans were not.
  await Promise.all(keys.map((key) => deleteStored(key)));

  // Not against the application — there is none any more — but the act itself
  // is recorded, with who did it and what is gone.
  await recordAudit({
    applicationId: null,
    action: "application_deleted",
    actorType: "AGENT",
    actorId: input.agentId,
    payload: { reference: application.reference, files: keys.length },
  });

  return { reference: application.reference };
}
