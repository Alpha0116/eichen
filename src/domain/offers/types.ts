import type { CurrencyCode, Minor } from "../finance/money";
import type { Quote } from "../finance/quote";
import type { EmploymentType, LoanPurpose } from "../application/types";

export type LenderKind = "BANK" | "PARTNER_BANK";

/**
 * How binding an offer is. The three values must stay visually distinct in the
 * UI: an indicative figure is not an offer, and an offer is not a contract.
 */
export type OfferStatus = "INDICATIVE" | "SUBJECT_TO_VERIFICATION" | "BINDING";

export interface LenderProduct {
  id: string;
  lenderName: string;
  lenderKind: LenderKind;
  /** Supervisory statement shown next to the lender name. */
  supervisionNote: string;
  country: string;
  currency: CurrencyCode;
  minAmount: Minor;
  maxAmount: Minor;
  minTermMonths: number;
  maxTermMonths: number;
  /** Rate for the best risk band, before any spread. */
  baseRate: number;
  /** Additional spread per score grade, overriding the rule set default. */
  gradeSpread: Record<string, number>;
  /** Rate adjustment by purpose, e.g. a secured vehicle loan is cheaper. */
  purposeAdjustment: Partial<Record<LoanPurpose, number>>;
  /** Rate adjustment applied above this term, longer money costs more. */
  longTermThresholdMonths: number;
  longTermAdjustment: number;
  allowedPurposes: LoanPurpose[];
  allowedEmployment: EmploymentType[];
  minNetMonthlyIncome: Minor;
  minAge: number;
  maxAgeAtMaturity: number;
  requiresBankCheck: boolean;
  features: {
    freeEarlyRepayment: boolean;
    paymentHolidaysPerYear: number;
    instantDecision: boolean;
    coBorrowerAllowed: boolean;
  };
  /** Optional residual-debt insurance, single premium as a share of capital. */
  insurancePremiumRate: number | null;
  /** Commission the platform receives, in basis points of the net amount. */
  commissionBps: number;
  /** Whether the lender pays for placement. Disclosed, never used to re-rank. */
  sponsored: boolean;
  expectedPayoutDays: number;
}

export interface Offer {
  productId: string;
  lenderName: string;
  lenderKind: LenderKind;
  supervisionNote: string;
  status: OfferStatus;
  grade: string;
  nominalAnnualRate: number;
  quote: Quote;
  features: LenderProduct["features"];
  insuranceAvailable: boolean;
  sponsored: boolean;
  commissionBps: number;
  expectedPayoutDays: number;
  /** Non-binding validity of the indicative figures. */
  validUntil: string;
  /** Reason codes explaining how this price was reached. */
  pricingFactors: string[];
}

export interface Ineligibility {
  productId: string;
  lenderName: string;
  reasonCodes: string[];
}

export interface OfferSet {
  offers: Offer[];
  ineligible: Ineligibility[];
  /** Ranking criterion actually applied, disclosed to the borrower. */
  rankedBy: "EFFECTIVE_RATE_ASC";
  generatedAt: string;
}
