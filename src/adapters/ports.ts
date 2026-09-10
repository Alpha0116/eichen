import type { BankCheckResult, BureauResult } from "../domain/application/types";
import type { Minor } from "../domain/finance/money";

/**
 * Ports for every external provider.
 *
 * The domain depends only on these interfaces. Swapping a simulated provider
 * for a real one (SCHUFA, a licensed account-information service, an ID
 * provider, a QES provider, a payment institution) is an implementation change
 * behind the same signature.
 *
 * Two rules hold across all of them:
 *  - calls are idempotent on `idempotencyKey`, because retries are normal;
 *  - a provider failure is a value (`status`), not an exception to swallow, so
 *    the funnel can offer the documented fallback instead of dead-ending.
 */

export interface ProviderCallMeta {
  idempotencyKey: string;
  /** Attempt number, starting at 1, for logging and backoff decisions. */
  attempt: number;
}

// --- Credit bureau ---------------------------------------------------------

export interface BureauQuery {
  applicationId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  postalCode: string;
  /**
   * NEUTRAL is the Konditionsanfrage: it must leave no trace other lenders can
   * see. RECORDED belongs to a firm application only.
   */
  enquiryType: "NEUTRAL" | "RECORDED";
}

export interface CreditBureauPort {
  readonly name: string;
  check(query: BureauQuery, meta: ProviderCallMeta): Promise<BureauResult>;
}

// --- Account check / open banking ------------------------------------------

export interface AccountCheckSession {
  sessionId: string;
  /** Where the borrower authenticates with their own bank. */
  authorisationUrl: string;
  expiresAt: string;
}

export interface AccountCheckPrefill {
  verifiedNetMonthlyIncome: Minor | null;
  detectedHousingCost: Minor | null;
  detectedLoanInstalments: Minor | null;
  employerName: string | null;
}

export interface AccountCheckPort {
  readonly name: string;
  start(
    input: { applicationId: string; bankName: string; observationMonths: number },
    meta: ProviderCallMeta,
  ): Promise<AccountCheckSession>;
  complete(
    input: { sessionId: string; applicationId: string },
    meta: ProviderCallMeta,
  ): Promise<{ result: BankCheckResult; prefill: AccountCheckPrefill }>;
}

// --- Identity verification -------------------------------------------------

export type IdentityMethod = "VIDEO_IDENT" | "DOCUMENT_UPLOAD" | "POST_IDENT";
export type IdentityStatus = "PENDING" | "IN_PROGRESS" | "VERIFIED" | "FAILED" | "EXPIRED";

export interface IdentitySession {
  sessionId: string;
  method: IdentityMethod;
  status: IdentityStatus;
  /** Null for methods completed offline. */
  redirectUrl: string | null;
  expiresAt: string;
  /** Present when status is FAILED; drives the fallback the UI proposes. */
  failureCode: string | null;
}

export interface IdentityPort {
  readonly name: string;
  start(
    input: { applicationId: string; method: IdentityMethod; locale: string },
    meta: ProviderCallMeta,
  ): Promise<IdentitySession>;
  poll(input: { sessionId: string }, meta: ProviderCallMeta): Promise<IdentitySession>;
}

// --- Electronic signature --------------------------------------------------

export interface SignatureEnvelope {
  envelopeId: string;
  status: "CREATED" | "SIGNED" | "FAILED" | "EXPIRED";
  expiresAt: string;
  signedAt: string | null;
  /** Hash of the exact document bytes that were signed. */
  documentHash: string;
  /** Hash over document, signer, timestamp and the drawing — the proof. */
  evidenceHash: string | null;
  /** SHA-256 of the signature image, so the drawing itself is verifiable. */
  signatureHash: string | null;
}

export interface SignaturePort {
  readonly name: string;
  create(
    input: { applicationId: string; documentHash: string; signerName: string },
    meta: ProviderCallMeta,
  ): Promise<SignatureEnvelope>;
  /**
   * Completes the signature with the drawing the borrower made.
   *
   * `signatureImage` is the raw PNG bytes of the stroke, not a code: the
   * evidence commits to what was actually drawn, so a different drawing —
   * or the same drawing against a different document — does not verify.
   */
  sign(
    input: { envelopeId: string; signatureImage: Buffer },
    meta: ProviderCallMeta,
  ): Promise<SignatureEnvelope>;
}

// --- Payments --------------------------------------------------------------

export interface PaymentInstruction {
  reference: string;
  amount: Minor;
  currency: string;
  /** Masked for storage; the full IBAN never leaves the payment provider. */
  maskedIban: string;
}

export type CollectionStatus = "SUBMITTED" | "SETTLED" | "RETURNED" | "FAILED";

/**
 * A card as the borrower typed it.
 *
 * It travels to the payment adapter and no further: nothing here is persisted,
 * logged or put in an audit payload. What comes back — the brand and the last
 * four digits — is all the rest of the system ever sees of a card.
 */
export interface CardPayment {
  number: string;
  holder: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
}

export interface ChargeOutcome {
  providerReference: string;
  status: CollectionStatus;
  declineCode: string | null;
  /** VISA, MASTERCARD, … as recognised by the provider. */
  brand: string;
  last4: string;
}

export interface PaymentPort {
  readonly name: string;
  /**
   * One-off charge against an application, used for the account fee. Distinct
   * from `collect`, which pulls a scheduled instalment from a live loan: here
   * no loan exists yet, and the borrower pushes the money rather than being
   * debited under a mandate.
   *
   * Idempotent on `reference`: replaying a charge returns the first outcome
   * rather than taking the money twice.
   */
  charge(
    input: {
      applicationId: string;
      amount: Minor;
      currency: string;
      reference: string;
      card: CardPayment;
    },
    meta: ProviderCallMeta,
  ): Promise<ChargeOutcome>;
  disburse(
    input: { applicationId: string; amount: Minor; currency: string; maskedIban: string },
    meta: ProviderCallMeta,
  ): Promise<{ reference: string; valueDate: string }>;
  collect(
    input: { loanId: string; instalmentIndex: number; amount: Minor; currency: string },
    meta: ProviderCallMeta,
  ): Promise<{ reference: string; status: CollectionStatus; returnCode: string | null }>;
}

// --- Notifications ---------------------------------------------------------

/** A message the outbox kept, for the back office to show what was sent. */
export interface SentMessage {
  messageId: string;
  channel: "EMAIL" | "SMS";
  to: string;
  replyTo?: string;
  templateKey: string;
  locale: string;
  variables: Record<string, string>;
  sentAt: string;
}

export interface NotificationPort {
  readonly name: string;
  /** Read-only view of what this process has sent. */
  messagesFor(recipient: string): SentMessage[];
  send(
    input: {
      channel: "EMAIL" | "SMS";
      to: string;
      /**
       * Where a reply goes, when that is not the sender.
       *
       * A message about one person's file is answered to that person, not to
       * the no-reply box the application authenticates as. The sender itself
       * cannot be borrowed: mail claiming to come from an address the server
       * is not authorised for fails SPF and DKIM and is dropped or filed as
       * spam, so the reply address is the honest way to do it.
       */
      replyTo?: string;
      templateKey: string;
      locale: string;
      /** Only non-sensitive substitutions; never an amount owed over SMS. */
      variables: Record<string, string>;
    },
    meta: ProviderCallMeta,
  ): Promise<{ messageId: string; status: "SENT" | "FAILED" }>;
}
