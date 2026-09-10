"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { CardPayment } from "@/adapters/ports";
import { CONSENTS_REQUIRED_BY_STAGE } from "@/domain/compliance/consents";
import { isEditable, type ApplicationState } from "@/domain/application/states";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { requireApplicationAccess } from "@/server/access";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { grantConsent } from "@/server/services/consent";
import { submitApplication, NoEligibleProductError } from "@/server/services/submission";
import { uploadDocument, UploadRejected, type DocumentKind } from "@/server/services/documents";
import { prepareSignature, signContract, withdrawContract } from "@/server/services/contract";
import {
  ChargeDeclinedError,
  FeeNotPayableError,
  payAccountFee,
} from "@/server/services/accountFee";
import { clampAmount, clampTerm } from "@/server/services/simulation";
import { maskIban } from "@/server/services/iban";

export type ActionState = { error?: string; field?: string; ok?: boolean };

function locale(value: string): string {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Refuses any edit to an application that has left the borrower's hands.
 *
 * The funnel pages already hide the forms once a file is submitted, but a
 * stale tab is enough to post to one of them. Amount and personal details are
 * what the administrator decided on, so a write after submission would make
 * the decision refer to a file that no longer exists.
 */
async function requireEditable(applicationId: string): Promise<void> {
  const { state } = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { state: true },
  });
  if (!isEditable(state as ApplicationState)) {
    throw new Error(`Application ${applicationId} is not editable in state ${state}`);
  }
}

const money = z.coerce.number().int().min(0).max(100_000_000);
const months = z.coerce.number().int().min(0).max(1200);

/**
 * Amounts arrive from the form in euros and are converted to cents here.
 * The boundary between the two units is this one function; nothing downstream
 * ever sees a decimal amount.
 */
const euros = z
  .string()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .pipe(z.coerce.number().min(0).max(1_000_000))
  .transform((value) => Math.round(value * 100));

const PURPOSES = [
  "FREE_USE",
  "VEHICLE",
  "RENOVATION",
  "DEBT_CONSOLIDATION",
  "FURNITURE",
  "EDUCATION",
  "MEDICAL",
  "TRAVEL",
] as const;

// --- Step 1a: the simulation ------------------------------------------------

const simulationSchema = z.object({
  amount: money,
  termMonths: months,
  purpose: z.enum(PURPOSES),
});

export async function saveSimulationAction(
  localeParam: string,
  applicationId: string,
  formData: FormData,
): Promise<void> {
  await requireApplicationAccess(applicationId);
  await requireEditable(applicationId);

  const safeLocale = locale(localeParam);
  const parsed = simulationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/${safeLocale}/apply/${applicationId}/simulation`);

  // Re-clamped server-side: the sliders are a convenience, not a validation
  // boundary.
  const amount = clampAmount(parsed.data.amount);
  const termMonths = clampTerm(parsed.data.termMonths);

  await db.application.update({
    where: { id: applicationId },
    data: { amount, termMonths, purpose: parsed.data.purpose, grantedAmount: null },
  });

  await recordAudit({
    applicationId,
    action: "application_updated",
    actorType: "CUSTOMER",
    payload: { step: "simulation", amount, termMonths, purpose: parsed.data.purpose },
  });

  redirect(`/${safeLocale}/apply/${applicationId}/profile`);
}

// --- Step 1b: who the borrower is ------------------------------------------

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(6).max(40),
  street: z.string().trim().min(1).max(160),
  postalCode: z.string().trim().min(4).max(12),
  city: z.string().trim().min(1).max(120),
  residentSinceMonths: months,

  employmentType: z.enum([
    "PERMANENT",
    "FIXED_TERM",
    "PROBATION",
    "CIVIL_SERVANT",
    "SELF_EMPLOYED",
    "PENSIONER",
    "STUDENT",
    "PARENTAL_LEAVE",
    "UNEMPLOYED",
  ]),
  employerName: z.string().trim().max(160).optional(),
  employedSinceMonths: months,
  employmentEndsOn: z.string().optional(),
  netMonthlyIncome: euros,
  otherMonthlyIncome: euros,

  adults: z.coerce.number().int().min(1).max(10),
  children: z.coerce.number().int().min(0).max(15),
  housingStatus: z.enum(["RENT", "OWN", "WITH_PARENTS"]),
  monthlyHousingCost: euros,
  existingLoanInstalments: euros,
  otherFixedCosts: euros,

  bankName: z.string().trim().min(1).max(120),
  iban: z.string().trim().min(15).max(42),

  withCoBorrower: z.string().optional(),
  coFirstName: z.string().trim().max(80).optional(),
  coLastName: z.string().trim().max(80).optional(),
  coBirthDate: z.string().optional(),
  coEmail: z.string().trim().max(200).optional(),
  coNetMonthlyIncome: z.string().optional(),
  coEmploymentType: z.string().optional(),
});

function isAdult(birthDate: string): boolean {
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return false;
  const eighteen = new Date(born);
  eighteen.setUTCFullYear(eighteen.getUTCFullYear() + 18);
  return eighteen <= new Date();
}

/**
 * Saves everything the file needs about the person: identity, the address they
 * live at, how they earn, what the household costs, and where a payout would
 * go.
 *
 * The IBAN is masked before it reaches the database and the raw value is never
 * written anywhere — not to the row, not to the audit payload. What is stored
 * is enough for a borrower to recognise their own account and no more.
 */
export async function saveProfileAction(
  localeParam: string,
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireApplicationAccess(applicationId);
  await requireEditable(applicationId);

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "validation", field: parsed.error.issues[0]?.path.join(".") };
  }
  const data = parsed.data;

  // Legal capacity is checked before anything is written: an application that
  // cannot lawfully be concluded should not be built up in the first place.
  if (!isAdult(data.birthDate)) return { error: "tooYoung", field: "birthDate" };

  const masked = maskIban(data.iban);
  if (!masked) return { error: "ibanInvalid", field: "iban" };

  const applicantFields = {
    firstName: data.firstName,
    lastName: data.lastName,
    birthDate: data.birthDate,
    email: data.email,
    phone: data.phone,
    street: data.street,
    postalCode: data.postalCode,
    city: data.city,
    residentSinceMonths: data.residentSinceMonths,
    employmentType: data.employmentType,
    employerName: data.employerName || null,
    employedSinceMonths: data.employedSinceMonths,
    employmentEndsOn: data.employmentEndsOn || null,
    netMonthlyIncome: data.netMonthlyIncome,
    otherMonthlyIncome: data.otherMonthlyIncome,
  };

  const wantsCoBorrower =
    data.withCoBorrower === "on" && Boolean(data.coFirstName && data.coLastName);

  const householdFields = {
    adults: data.adults,
    children: data.children,
    housingStatus: data.housingStatus,
    monthlyHousingCost: data.monthlyHousingCost,
    existingLoanInstalments: data.existingLoanInstalments,
    otherFixedCosts: data.otherFixedCosts,
  };

  await db.$transaction(async (tx) => {
    await tx.applicant.upsert({
      where: { applicationId_role: { applicationId, role: "PRIMARY" } },
      update: applicantFields,
      create: { applicationId, role: "PRIMARY", ...applicantFields },
    });
    await tx.household.upsert({
      where: { applicationId },
      update: householdFields,
      create: { applicationId, ...householdFields },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: { bankName: data.bankName, maskedIban: masked },
    });

    // Unticking the box removes the second borrower rather than leaving a
    // stale row behind: affordability reads whatever is there, so a forgotten
    // co-borrower would keep inflating the household income.
    if (wantsCoBorrower) {
      const coFields = {
        firstName: data.coFirstName!,
        lastName: data.coLastName!,
        birthDate: data.coBirthDate || "",
        email: data.coEmail || "",
        employmentType: data.coEmploymentType || "PERMANENT",
        netMonthlyIncome: data.coNetMonthlyIncome
          ? Math.round(Number(data.coNetMonthlyIncome.replace(",", ".")) * 100)
          : 0,
      };
      await tx.applicant.upsert({
        where: { applicationId_role: { applicationId, role: "CO_BORROWER" } },
        update: coFields,
        create: { applicationId, role: "CO_BORROWER", phone: "", street: "", postalCode: "", city: "", ...coFields },
      });
    } else {
      await tx.applicant.deleteMany({ where: { applicationId, role: "CO_BORROWER" } });
    }
  });

  await recordAudit({
    applicationId,
    action: "application_updated",
    actorType: "CUSTOMER",
    payload: {
      step: "profile",
      employmentType: data.employmentType,
      bankName: data.bankName,
      coBorrower: wantsCoBorrower,
    },
  });

  redirect(`/${locale(localeParam)}/apply/${applicationId}/documents`);
}

// --- Step 1c: the files ----------------------------------------------------

export async function uploadDocumentAction(
  localeParam: string,
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireApplicationAccess(applicationId);

  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "OTHER") as DocumentKind;
  if (!(file instanceof File) || file.size === 0) return { error: "required", field: "file" };

  try {
    await uploadDocument({
      applicationId,
      kind,
      filename: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  } catch (error) {
    if (error instanceof UploadRejected) return { error: error.code, field: "file" };
    throw error;
  }

  revalidatePath(`/${locale(localeParam)}/apply/${applicationId}/documents`);
  return { ok: true };
}

// --- Step 1d: the SCHUFA option, the consents, and submission ---------------

/**
 * Records the one place SCHUFA appears in this product: an option the borrower
 * ticks or does not.
 *
 * It is declarative. No bureau is queried, the price does not move, and the
 * administrator's decision does not read it. It is stored because it was
 * offered and answered, which is the only claim the interface makes about it.
 */
export async function submitApplicationAction(
  localeParam: string,
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireApplicationAccess(applicationId);
  const safeLocale = locale(localeParam);
  await requireEditable(applicationId);

  for (const purpose of CONSENTS_REQUIRED_BY_STAGE.SUBMISSION) {
    if (formData.get(`consent_${purpose}`) !== "on") {
      return { error: "consentRequired", field: purpose };
    }
    await grantConsent({
      applicationId,
      userId: access.user?.id ?? null,
      purpose,
      locale: safeLocale as Locale,
      granted: true,
    });
  }

  if (formData.get("consent_MARKETING_EMAIL") === "on") {
    await grantConsent({
      applicationId,
      userId: access.user?.id ?? null,
      purpose: "MARKETING_EMAIL",
      locale: safeLocale as Locale,
      granted: true,
    });
  }

  const schufaOptIn = formData.get("schufaOptIn") === "on";
  await db.application.update({ where: { id: applicationId }, data: { schufaOptIn } });
  await recordAudit({
    applicationId,
    action: "application_updated",
    actorType: "CUSTOMER",
    actorId: access.user?.id ?? null,
    payload: { step: "review", schufaOptIn },
  });

  try {
    await submitApplication(applicationId, { actorId: access.user?.id ?? null });
  } catch (error) {
    if (error instanceof NoEligibleProductError) {
      return { error: "notEligible", field: "amount" };
    }
    throw error;
  }

  redirect(`/${safeLocale}/apply/${applicationId}/status`);
}

// --- Step 3: the contract ---------------------------------------------------

/** Largest signature we accept. A stroke is a few kilobytes; this is slack. */
const MAX_SIGNATURE_BYTES = 512 * 1024;

/**
 * Records the borrower's handwritten signature.
 *
 * The drawing arrives as a PNG data URL from a canvas. It is decoded and
 * length-checked here, at the boundary, before any of it reaches the signing
 * provider: the browser is not a validation boundary, and a data URL is an
 * easy place to hide something much larger than a signature.
 */
export async function signContractAction(
  localeParam: string,
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireApplicationAccess(applicationId);
  const safeLocale = locale(localeParam);

  if (formData.get("consent_PRECONTRACTUAL_INFO") !== "on") {
    return { error: "consentRequired", field: "PRECONTRACTUAL_INFO" };
  }

  const dataUrl = String(formData.get("signature") ?? "");
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return { error: "signatureRequired", field: "signature" };

  const signatureImage = Buffer.from(match[1], "base64");
  if (signatureImage.byteLength > MAX_SIGNATURE_BYTES) {
    return { error: "signatureTooLarge", field: "signature" };
  }

  await grantConsent({
    applicationId,
    userId: access.user?.id ?? null,
    purpose: "PRECONTRACTUAL_INFO",
    locale: safeLocale as Locale,
    granted: true,
  });

  // Opening the envelope here rather than on page load keeps the whole act —
  // consent, drawing, signature — inside one request the borrower initiated.
  await prepareSignature(applicationId);

  const result = await signContract(applicationId, signatureImage);
  if (!result.ok) {
    return {
      error: result.reason === "EXPIRED" ? "signatureExpired" : "signatureRequired",
      field: "signature",
    };
  }
  redirect(`/${safeLocale}/apply/${applicationId}/fee`);
}

export async function withdrawContractAction(
  localeParam: string,
  applicationId: string,
): Promise<void> {
  const access = await requireApplicationAccess(applicationId);
  await withdrawContract(applicationId, access.user?.id ?? null);
  redirect(`/${locale(localeParam)}/apply/${applicationId}/status`);
}

// --- Step 4: the account fee ------------------------------------------------

/**
 * Reads the card off the form.
 *
 * Everything the borrower typed is checked here before a provider is called:
 * a mistyped digit, a card that expired last month and a three-character CVC
 * are the borrower's own typing errors, and telling them so costs nothing,
 * while a declined charge costs an attempt and reads like their bank refused.
 *
 * The card never leaves this function except into the payment adapter. It is
 * not logged, not put in an action state that would travel back to the page,
 * and not written anywhere.
 */
function readCard(
  formData: FormData,
): { card: CardPayment } | { error: { error: string; field: string } } {
  const number = String(formData.get("cardNumber") ?? "").replace(/[\s-]/g, "");
  const holder = String(formData.get("cardHolder") ?? "").trim();
  const expiry = String(formData.get("cardExpiry") ?? "").trim();
  const cvc = String(formData.get("cardCvc") ?? "").trim();

  if (!/^\d{12,19}$/.test(number) || !luhn(number)) {
    return { error: { error: "cardNumberInvalid", field: "cardNumber" } };
  }
  if (holder.length < 2 || holder.length > 60) {
    return { error: { error: "cardHolderInvalid", field: "cardHolder" } };
  }

  const parts = /^(\d{2})\s*\/?\s*(\d{2}|\d{4})$/.exec(expiry);
  if (!parts) return { error: { error: "cardExpiryInvalid", field: "cardExpiry" } };
  const month = Number(parts[1]);
  const year = parts[2]!.length === 2 ? 2000 + Number(parts[2]) : Number(parts[2]);
  if (month < 1 || month > 12) {
    return { error: { error: "cardExpiryInvalid", field: "cardExpiry" } };
  }
  // A card is good until the last day of the month it names.
  const expiresAfter = new Date(Date.UTC(year, month, 1));
  if (expiresAfter <= new Date()) {
    return { error: { error: "cardExpired", field: "cardExpiry" } };
  }

  if (!/^\d{3,4}$/.test(cvc)) return { error: { error: "cardCvcInvalid", field: "cardCvc" } };

  return { card: { number, holder, expiryMonth: month, expiryYear: year, cvc } };
}

/** The check digit every card number carries, which catches a single typo. */
function luhn(number: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = number.length - 1; index >= 0; index -= 1) {
    let digit = number.charCodeAt(index) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}


export async function payAccountFeeAction(
  localeParam: string,
  applicationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireApplicationAccess(applicationId);
  const safeLocale = locale(localeParam);

  const card = readCard(formData);
  if ("error" in card) return card.error;

  if (formData.get("consent_ACCOUNT_FEE_TERMS") !== "on") {
    return { error: "consentRequired", field: "ACCOUNT_FEE_TERMS" };
  }
  await grantConsent({
    applicationId,
    userId: access.user?.id ?? null,
    purpose: "ACCOUNT_FEE_TERMS",
    locale: safeLocale as Locale,
    granted: true,
  });

  try {
    await payAccountFee(applicationId, { card: card.card, actorId: access.user?.id ?? null });
  } catch (error) {
    // A decline is a normal outcome, not a crash: the borrower is told why and
    // can try again, with this card or another one.
    if (error instanceof ChargeDeclinedError) return { error: "chargeDeclined", field: "cardNumber" };
    if (error instanceof FeeNotPayableError) return { error: `fee${error.code}` };
    throw error;
  }

  redirect(`/${safeLocale}/apply/${applicationId}/processing`);
}
