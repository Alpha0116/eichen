import { createHash } from "node:crypto";
import {
  CONSENT_DEFINITIONS,
  missingConsents,
  type ConsentPurpose,
  type ConsentStage,
} from "../../domain/compliance/consents";
import { getDictionary, type Locale } from "../../i18n";
import { recordAudit } from "../audit";
import { db } from "../db";

export class ConsentRequiredError extends Error {
  constructor(public readonly missing: ConsentPurpose[]) {
    super(`Missing consent: ${missing.join(", ")}`);
    this.name = "ConsentRequiredError";
  }
}

/**
 * Hash of the wording actually shown, resolved from the dictionary of the
 * locale the borrower was reading. Storing it means a dispute can be settled
 * with the exact sentence rather than with whatever the current release says.
 */
export function consentTextHash(purpose: ConsentPurpose, locale: Locale): string {
  const dictionary = getDictionary(locale);
  const key = CONSENT_DEFINITIONS[purpose].textKey.replace(/^consent\./, "");
  const text = (dictionary.consent as unknown as Record<string, string>)[key] ?? "";
  return createHash("sha256").update(`${purpose}|${locale}|${text}`, "utf8").digest("hex");
}

export interface GrantConsentInput {
  applicationId: string | null;
  userId: string | null;
  purpose: ConsentPurpose;
  locale: Locale;
  granted: boolean;
  ipHash?: string | null;
  userAgentHash?: string | null;
}

export async function grantConsent(input: GrantConsentInput): Promise<void> {
  const definition = CONSENT_DEFINITIONS[input.purpose];

  await db.consent.create({
    data: {
      applicationId: input.applicationId,
      userId: input.userId,
      purpose: input.purpose,
      version: definition.version,
      granted: input.granted,
      textHash: consentTextHash(input.purpose, input.locale),
      locale: input.locale,
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
    },
  });

  await recordAudit({
    applicationId: input.applicationId,
    action: "consent_granted",
    actorType: "CUSTOMER",
    actorId: input.userId,
    payload: {
      purpose: input.purpose,
      version: definition.version,
      granted: input.granted,
      locale: input.locale,
    },
  });
}

/**
 * Withdrawal is recorded on the existing row rather than by deleting it: the
 * fact that consent was once given, and when it ended, is itself part of the
 * record.
 */
export async function revokeConsent(
  purpose: ConsentPurpose,
  scope: { applicationId?: string | null; userId?: string | null },
): Promise<void> {
  const definition = CONSENT_DEFINITIONS[purpose];
  if (!definition.revocable) throw new Error(`Consent ${purpose} is not revocable`);

  await db.consent.updateMany({
    where: {
      purpose,
      granted: true,
      revokedAt: null,
      ...(scope.applicationId ? { applicationId: scope.applicationId } : {}),
      ...(scope.userId ? { userId: scope.userId } : {}),
    },
    data: { revokedAt: new Date() },
  });

  await recordAudit({
    applicationId: scope.applicationId ?? null,
    action: "consent_revoked",
    actorType: "CUSTOMER",
    actorId: scope.userId ?? null,
    payload: { purpose },
  });
}

export async function consentsFor(applicationId: string) {
  return db.consent.findMany({
    where: { applicationId },
    orderBy: { grantedAt: "desc" },
  });
}

/** Throws unless every consent the stage requires is in place and current. */
export async function assertConsents(
  applicationId: string,
  stage: ConsentStage,
): Promise<void> {
  const records = await db.consent.findMany({ where: { applicationId } });
  const missing = missingConsents(stage, records);
  if (missing.length > 0) throw new ConsentRequiredError(missing);
}

export async function pendingConsents(
  applicationId: string,
  stage: ConsentStage,
): Promise<ConsentPurpose[]> {
  const records = await db.consent.findMany({ where: { applicationId } });
  return missingConsents(stage, records);
}
