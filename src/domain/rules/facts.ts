import { annuityInstalment, monthlyRateOf } from "../finance/annuity";
import type { ApplicationSnapshot } from "../application/types";
import type { Facts } from "./conditions";
import { assessAffordability, type AffordabilityResult } from "./affordability";
import type { AffordabilityConfig } from "./types";

/**
 * The complete vocabulary a rule set may reference. Publishing a rule set that
 * reads anything outside this list is rejected.
 *
 * Nothing derived from a protected characteristic appears here — no
 * nationality, gender, marital status, age beyond the statutory capacity check,
 * nor any browsing or device signal. Adding a proxy for one of those is a
 * change to this list, which makes it reviewable.
 */
export const KNOWN_FACTS = [
  "applicant_age",
  "employment_type",
  "employment_months",
  "employment_ends_before_maturity",
  "residency_months",
  "country",
  "has_co_borrower",
  "co_borrower_employment_type",
  "declared_net_income",
  "household_income",
  "disposable_income",
  "max_affordable_instalment",
  "existing_loan_instalments",
  "requested_amount",
  "requested_term_months",
  "requested_instalment",
  "instalment_headroom",
  "instalment_to_disposable",
  "debt_service_ratio_after",
  "purpose",
  "bureau_status",
  "bureau_score",
  "bureau_negative_items",
  "bureau_thin_file",
  "bank_check_status",
  "bank_income_deviation",
  "bank_overdraft_days",
  "bank_returned_debits",
  "income_evidence",
] as const;

export type KnownFact = (typeof KNOWN_FACTS)[number];

export interface FactsBuildResult {
  facts: Facts;
  affordability: AffordabilityResult;
  /** Instalment the request implies at the reference rate, used for headroom. */
  referenceInstalment: number;
}

function ageInYears(birthDate: string, now: Date): number | null {
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

function monthsUntil(dateString: string | null, now: Date): number | null {
  if (!dateString) return null;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;
  return (
    (target.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (target.getUTCMonth() - now.getUTCMonth())
  );
}

/**
 * Projects an application onto the flat fact set the rule engine consumes.
 *
 * `referenceRate` is the pricing rate used to turn the requested amount and
 * term into an instalment, so affordability is tested against a real payment
 * rather than against the bare principal.
 */
export function buildFacts(
  snapshot: ApplicationSnapshot,
  config: AffordabilityConfig,
  referenceRate: number,
  now = new Date(),
): FactsBuildResult {
  const { applicant, coApplicant, household, request, bureau, bankCheck } = snapshot;

  const affordability = assessAffordability(
    {
      netMonthlyIncome: applicant.netMonthlyIncome,
      coBorrowerNetMonthlyIncome: coApplicant?.netMonthlyIncome ?? 0,
      otherMonthlyIncome: applicant.otherMonthlyIncome + (coApplicant?.otherMonthlyIncome ?? 0),
      adults: household.adults,
      children: household.children,
      monthlyHousingCost: household.monthlyHousingCost,
      existingLoanInstalments: household.existingLoanInstalments,
      otherFixedCosts: household.otherFixedCosts,
    },
    config,
  );

  const referenceInstalment = annuityInstalment(
    request.amount,
    monthlyRateOf(referenceRate),
    request.termMonths,
  );

  const monthsToContractEnd = monthsUntil(applicant.employmentEndsOn, now);

  // Declared income is only trustworthy once something corroborates it. A
  // positive deviation (verified income above declared) is still a deviation.
  const bankIncomeDeviation =
    bankCheck.verifiedNetMonthlyIncome !== null && applicant.netMonthlyIncome > 0
      ? Math.abs(bankCheck.verifiedNetMonthlyIncome - applicant.netMonthlyIncome) /
        applicant.netMonthlyIncome
      : null;

  const facts: Record<KnownFact, Facts[string]> = {
    applicant_age: ageInYears(applicant.birthDate, now),
    employment_type: applicant.employmentType,
    employment_months: applicant.employedSinceMonths,
    employment_ends_before_maturity:
      monthsToContractEnd !== null && monthsToContractEnd < request.termMonths,
    residency_months: applicant.residentSinceMonths,
    country: applicant.country,
    has_co_borrower: coApplicant !== null,
    co_borrower_employment_type: coApplicant?.employmentType ?? null,
    declared_net_income: applicant.netMonthlyIncome,
    household_income: affordability.totalIncome,
    disposable_income: affordability.disposableIncome,
    max_affordable_instalment: affordability.maxAffordableInstalment,
    existing_loan_instalments: household.existingLoanInstalments,
    requested_amount: request.amount,
    requested_term_months: request.termMonths,
    requested_instalment: referenceInstalment,
    instalment_headroom: affordability.maxAffordableInstalment - referenceInstalment,
    instalment_to_disposable:
      affordability.disposableIncome > 0
        ? referenceInstalment / affordability.disposableIncome
        : null,
    debt_service_ratio_after:
      affordability.totalIncome > 0
        ? (household.existingLoanInstalments + referenceInstalment) / affordability.totalIncome
        : null,
    purpose: request.purpose,
    bureau_status: bureau.status,
    bureau_score: bureau.score,
    bureau_negative_items: bureau.negativeItems,
    bureau_thin_file: bureau.thinFile,
    bank_check_status: bankCheck.status,
    bank_income_deviation: bankIncomeDeviation,
    bank_overdraft_days: bankCheck.overdraftDays,
    bank_returned_debits: bankCheck.returnedDirectDebits,
    income_evidence: bankCheck.status === "VERIFIED" ? "VERIFIED" : "SELF_DECLARED",
  };

  return { facts, affordability, referenceInstalment };
}
