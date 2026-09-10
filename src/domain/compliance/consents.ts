/**
 * Consent registry.
 *
 * A consent is only meaningful if you can say later exactly what was agreed to:
 * which purpose, which wording, at which version, when, and whether it has
 * since been withdrawn. Every entry therefore carries a version and the hash of
 * the text that was actually displayed.
 */

export const CONSENT_PURPOSES = [
  "TERMS_AND_PRIVACY",
  "PRECONTRACTUAL_INFO",
  "ACCOUNT_FEE_TERMS",
  "SEPA_MANDATE",
  "MARKETING_EMAIL",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export interface ConsentDefinition {
  purpose: ConsentPurpose;
  version: number;
  /** Dictionary key of the exact wording presented. */
  textKey: string;
  /** A required consent blocks the step; an optional one never does. */
  required: boolean;
  /** Whether the borrower can withdraw it later from their account area. */
  revocable: boolean;
  /**
   * Withdrawal has consequences the borrower must see before they confirm,
   * e.g. losing the instant decision.
   */
  withdrawalNoticeKey: string | null;
}

export const CONSENT_DEFINITIONS: Record<ConsentPurpose, ConsentDefinition> = {
  TERMS_AND_PRIVACY: {
    purpose: "TERMS_AND_PRIVACY",
    version: 1,
    textKey: "consent.terms_and_privacy",
    required: true,
    revocable: false,
    withdrawalNoticeKey: null,
  },
  PRECONTRACTUAL_INFO: {
    purpose: "PRECONTRACTUAL_INFO",
    version: 1,
    textKey: "consent.precontractual_info",
    required: true,
    revocable: false,
    withdrawalNoticeKey: null,
  },
  ACCOUNT_FEE_TERMS: {
    purpose: "ACCOUNT_FEE_TERMS",
    version: 1,
    textKey: "consent.account_fee_terms",
    required: true,
    revocable: false,
    withdrawalNoticeKey: null,
  },
  SEPA_MANDATE: {
    purpose: "SEPA_MANDATE",
    version: 1,
    textKey: "consent.sepa_mandate",
    required: false,
    revocable: true,
    withdrawalNoticeKey: "consent.sepa_mandate.withdrawal_notice",
  },
  MARKETING_EMAIL: {
    purpose: "MARKETING_EMAIL",
    version: 1,
    textKey: "consent.marketing_email",
    required: false,
    revocable: true,
    withdrawalNoticeKey: null,
  },
};

/**
 * Consents that must be in place before a given stage may run.
 *
 * There is no automated-decision consent because there is no automated
 * decision: every application is validated by a person. A consent for a
 * processing that does not happen would be worse than no consent at all — it
 * would describe the product inaccurately in the one place a borrower is
 * entitled to rely on.
 *
 * The fee is its own stage. The borrower agrees to the charge, at the amount
 * shown, immediately before paying it — not buried in the terms accepted at
 * submission, when no amount was known yet.
 */
export const CONSENTS_REQUIRED_BY_STAGE = {
  SUBMISSION: ["TERMS_AND_PRIVACY"],
  CONTRACT: ["PRECONTRACTUAL_INFO"],
  ACCOUNT_FEE: ["ACCOUNT_FEE_TERMS"],
  DIRECT_DEBIT: ["SEPA_MANDATE"],
} as const satisfies Record<string, readonly ConsentPurpose[]>;

export type ConsentStage = keyof typeof CONSENTS_REQUIRED_BY_STAGE;

export interface ConsentRecordLike {
  purpose: string;
  version: number;
  granted: boolean;
  revokedAt: Date | string | null;
}

/** Purposes still missing for a stage, in the order they should be presented. */
export function missingConsents(
  stage: ConsentStage,
  records: readonly ConsentRecordLike[],
): ConsentPurpose[] {
  return CONSENTS_REQUIRED_BY_STAGE[stage].filter((purpose) => {
    const definition = CONSENT_DEFINITIONS[purpose];
    return !records.some(
      (record) =>
        record.purpose === purpose &&
        record.granted &&
        record.revokedAt === null &&
        // A consent given against an older wording no longer covers the action.
        record.version >= definition.version,
    );
  });
}
