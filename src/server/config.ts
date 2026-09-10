import type { CurrencyCode } from "../domain/finance/money";

/**
 * Product limits and the rate.
 *
 * There is a single rate: 3 % nominal per year, the same for everyone. No risk
 * grade, no purpose adjustment, no term surcharge. Because the simulator, the
 * decision engine and the contract all read `referenceRate`, the figure a
 * visitor is shown and the figure they are charged cannot drift apart.
 */
export const PRODUCT = {
  country: "DE",
  currency: "EUR" as CurrencyCode,
  minAmount: 100_000,
  maxAmount: 8_000_000,
  amountStep: 50_000,
  defaultAmount: 1_000_000,
  minTermMonths: 12,
  maxTermMonths: 120,
  defaultTermMonths: 48,
  termOptions: [12, 24, 36, 48, 60, 72, 84, 96, 120],
  referenceRate: 0.03,
  /** How long an unfinished application stays resumable. */
  draftTtlDays: 30,
  /** Validity of the indicative and pre-contractual offers. */
  offerValidDays: 14,
  /** Statutory withdrawal period for consumer credit. */
  withdrawalDays: 14,
  /** Observation window requested from the account-information service. */
  accountCheckMonths: 3,
  /** Applications above this age with no activity are expired by the sweeper. */
  staleDraftDays: 45,
} as const;

/**
 * Account fee, charged once after signature and before the payout.
 *
 * A percentage of the granted amount, floored and capped so a small loan is
 * not swamped by the fee and a large one does not carry a disproportionate
 * one. Both bounds are applied to the percentage result, in that order.
 */
export const ACCOUNT_FEE = {
  rate: 0.01,
  minAmount: 4_900,
  maxAmount: 49_900,
  currency: "EUR" as CurrencyCode,
  /** How long a fee instruction stays payable before it must be reissued. */
  validDays: 14,
} as const;

/** The fee due on a given granted amount, in cents. */
export function accountFeeFor(grantedAmount: number): number {
  const raw = Math.round(grantedAmount * ACCOUNT_FEE.rate);
  return Math.min(ACCOUNT_FEE.maxAmount, Math.max(ACCOUNT_FEE.minAmount, raw));
}

/**
 * Where the borrower can reach a human. Both are rendered as links the
 * visitor's own device resolves — wa.me for WhatsApp, mailto: for email — so
 * nothing about the conversation passes through this application.
 */
export const CONTACT = {
  /** International format, digits only, as wa.me requires. */
  whatsappNumber: process.env.EICHEN_WHATSAPP_NUMBER ?? "4915112345678",
  email: process.env.EICHEN_CONTACT_EMAIL ?? "kontakt@eichen-kredit.com",
  /**
   * Where the back office is told that a contract has been signed.
   *
   * Falls back to the public contact address so the notification is never
   * silently dropped for want of configuration; set EICHEN_OPS_EMAIL to route
   * it somewhere else.
   */
  opsEmail: process.env.EICHEN_OPS_EMAIL ?? process.env.EICHEN_CONTACT_EMAIL ?? "kontakt@eichen-kredit.com",
} as const;

export function whatsappLink(message?: string): string {
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${CONTACT.whatsappNumber}${query}`;
}

export function mailtoLink(subject?: string): string {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${CONTACT.email}${query}`;
}

export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"] as const,
} as const;

export const SLA = {
  /** Target for a referred application to receive a human decision. */
  manualDecisionHours: 24,
  documentReviewHours: 8,
} as const;

/**
 * Statutory reference figures. `baseRate` is the Basiszinssatz published twice
 * a year by the Bundesbank; consumer default interest runs five points above
 * it (§ 288 (1) BGB). Both are configuration, not constants of nature — they
 * are reviewed each time the base rate is republished.
 */
export const STATUTORY = {
  baseRate: 0.0127,
  defaultInterestMargin: 0.05,
} as const;

export function defaultInterestRate(): number {
  return STATUTORY.baseRate + STATUTORY.defaultInterestMargin;
}
