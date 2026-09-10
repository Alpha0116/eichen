import type { CurrencyCode, Minor } from "../finance/money";

export type EmploymentType =
  | "PERMANENT"
  | "FIXED_TERM"
  | "PROBATION"
  | "CIVIL_SERVANT"
  | "SELF_EMPLOYED"
  | "PENSIONER"
  | "STUDENT"
  | "PARENTAL_LEAVE"
  | "UNEMPLOYED";

export type HousingStatus = "RENT" | "OWN" | "WITH_PARENTS";

export type LoanPurpose =
  | "FREE_USE"
  | "VEHICLE"
  | "RENOVATION"
  | "DEBT_CONSOLIDATION"
  | "FURNITURE"
  | "EDUCATION"
  | "MEDICAL"
  | "TRAVEL";

/** Purposes a lender may price differently, e.g. a secured vehicle loan. */
export const PURPOSES_AFFECTING_PRICE: readonly LoanPurpose[] = [
  "VEHICLE",
  "DEBT_CONSOLIDATION",
];

export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  residentSinceMonths: number;
  employmentType: EmploymentType;
  employerName: string | null;
  employedSinceMonths: number;
  /** Set for fixed-term contracts; a contract ending inside the loan term matters. */
  employmentEndsOn: string | null;
  netMonthlyIncome: Minor;
  otherMonthlyIncome: Minor;
}

export interface HouseholdProfile {
  adults: number;
  children: number;
  housingStatus: HousingStatus;
  monthlyHousingCost: Minor;
  existingLoanInstalments: Minor;
  otherFixedCosts: Minor;
}

export interface LoanRequest {
  amount: Minor;
  termMonths: number;
  purpose: LoanPurpose;
  currency: CurrencyCode;
}

export type BureauStatus = "PENDING" | "SOFT_OK" | "SOFT_NEGATIVE" | "UNAVAILABLE";

export interface BureauResult {
  status: BureauStatus;
  /** Normalised 0–100; higher is better. Never presented as a verdict. */
  score: number | null;
  negativeItems: number | null;
  thinFile: boolean;
  /**
   * A Konditionsanfrage must stay neutral for the applicant's bureau record;
   * only a firm application may file an enquiry that other lenders can see.
   */
  enquiryType: "NEUTRAL" | "RECORDED";
  checkedAt: string | null;
}

export type BankCheckStatus = "NOT_STARTED" | "CONSENTED" | "VERIFIED" | "FAILED" | "SKIPPED";

export interface BankCheckResult {
  status: BankCheckStatus;
  verifiedNetMonthlyIncome: Minor | null;
  /** Number of days the account was overdrawn in the observation window. */
  overdraftDays: number | null;
  returnedDirectDebits: number | null;
  detectedLoanInstalments: Minor | null;
  observationMonths: number | null;
  completedAt: string | null;
}

export interface ApplicationSnapshot {
  applicant: ApplicantProfile;
  coApplicant: ApplicantProfile | null;
  household: HouseholdProfile;
  request: LoanRequest;
  bureau: BureauResult;
  bankCheck: BankCheckResult;
}
