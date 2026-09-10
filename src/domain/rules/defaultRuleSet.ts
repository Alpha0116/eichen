import type { RuleSet } from "./types";

/**
 * Reference rule set for the German market, version 1.
 *
 * Every threshold here is a product decision, not a law, and is meant to be
 * edited by the risk team in the back office — publishing an edit creates a new
 * version rather than mutating this one, so any past decision can be replayed
 * against the exact set that produced it.
 *
 * Allowances are monthly, in cents.
 */
export const DEFAULT_RULE_SET_DE: RuleSet = {
  key: "de-consumer-standard",
  version: 1,
  country: "DE",
  currency: "EUR",
  publishedAt: "2026-01-01T00:00:00.000Z",
  baseScore: 100,
  minScoreToAccept: 120,
  minScoreToRefer: 60,
  bands: [
    { minScore: 180, grade: "A", rateSpread: 0, maxAmountFactor: 1 },
    { minScore: 150, grade: "B", rateSpread: 0.012, maxAmountFactor: 1 },
    { minScore: 120, grade: "C", rateSpread: 0.028, maxAmountFactor: 1 },
    { minScore: 90, grade: "D", rateSpread: 0.049, maxAmountFactor: 0.75 },
  ],
  affordability: {
    // Living allowances cover food, clothing, transport and utilities only —
    // housing and existing commitments are deducted separately, so stacking a
    // high allowance on top of them would double-count and refuse households
    // that can comfortably afford the instalment.
    baseAllowanceFirstAdult: 95_000,
    baseAllowancePerAdditionalAdult: 35_000,
    baseAllowancePerChild: 25_000,
    maxInstalmentShareOfDisposable: 0.85,
    maxDebtServiceRatio: 0.45,
  },
  rules: [
    // --- Legal capacity and scope -----------------------------------------
    {
      key: "age_minimum",
      description: "Applicant must have full legal capacity to contract.",
      when: { op: "lt", fact: "applicant_age", value: 18 },
      effect: "DECLINE",
      reasonCode: "reason.age_minimum",
    },
    {
      key: "age_unknown",
      description: "Birth date missing or unparseable.",
      when: { op: "isNull", fact: "applicant_age" },
      effect: "REFER",
      reasonCode: "reason.identity_incomplete",
    },
    {
      key: "age_maximum",
      description: "Beyond this age the loan is referred for manual assessment.",
      when: { op: "gt", fact: "applicant_age", value: 75 },
      effect: "REFER",
      reasonCode: "reason.age_at_maturity",
    },
    {
      key: "residency_country",
      description: "Only residents of the country the product is licensed in.",
      when: { op: "neq", fact: "country", value: "DE" },
      effect: "DECLINE",
      reasonCode: "reason.residency_country",
    },
    {
      key: "residency_short",
      description: "Less than six months of local residence needs a human look.",
      when: { op: "lt", fact: "residency_months", value: 6 },
      effect: "REFER",
      reasonCode: "reason.residency_short",
    },

    // --- Employment --------------------------------------------------------
    {
      key: "employment_unemployed",
      description: "No income from employment or pension.",
      when: { op: "eq", fact: "employment_type", value: "UNEMPLOYED" },
      effect: "DECLINE",
      reasonCode: "reason.no_regular_income",
    },
    {
      key: "employment_probation",
      description: "Probation period is not yet a stable income.",
      when: { op: "eq", fact: "employment_type", value: "PROBATION" },
      effect: "REFER",
      reasonCode: "reason.employment_probation",
    },
    {
      key: "employment_ends_before_maturity",
      description: "Fixed-term contract expiring before the last instalment.",
      when: { op: "eq", fact: "employment_ends_before_maturity", value: true },
      effect: "REFER",
      reasonCode: "reason.contract_ends_early",
    },
    {
      key: "employment_self_employed",
      description: "Self-employed income requires tax assessments.",
      when: { op: "eq", fact: "employment_type", value: "SELF_EMPLOYED" },
      effect: "REFER",
      reasonCode: "reason.self_employed_review",
    },
    {
      key: "employment_student",
      description: "Student income is reviewed manually.",
      when: { op: "in", fact: "employment_type", values: ["STUDENT", "PARENTAL_LEAVE"] },
      effect: "REFER",
      reasonCode: "reason.income_type_review",
    },
    {
      key: "employment_stable_long",
      description: "Two years or more in a permanent or public-sector post.",
      when: {
        op: "and",
        of: [
          { op: "in", fact: "employment_type", values: ["PERMANENT", "CIVIL_SERVANT"] },
          { op: "gte", fact: "employment_months", value: 24 },
        ],
      },
      effect: "SCORE",
      points: 30,
      reasonCode: "reason.employment_stable",
    },
    {
      key: "employment_recent",
      description: "Under six months with the current employer.",
      when: { op: "lt", fact: "employment_months", value: 6 },
      effect: "SCORE",
      points: -30,
      reasonCode: "reason.employment_recent",
    },

    // --- Affordability -----------------------------------------------------
    {
      key: "affordability_no_headroom",
      description: "The instalment exceeds what the household budget supports.",
      when: { op: "lt", fact: "instalment_headroom", value: 0 },
      effect: "DECLINE",
      reasonCode: "reason.affordability",
    },
    {
      key: "affordability_tight",
      description: "The instalment eats most of the disposable income.",
      when: { op: "gt", fact: "instalment_to_disposable", value: 0.6 },
      effect: "SCORE",
      points: -40,
      reasonCode: "reason.affordability_tight",
    },
    {
      key: "affordability_comfortable",
      description: "The instalment stays well inside the budget.",
      when: { op: "lt", fact: "instalment_to_disposable", value: 0.25 },
      effect: "SCORE",
      points: 20,
      reasonCode: "reason.affordability_comfortable",
    },
    {
      key: "debt_service_ceiling",
      description: "Total debt service after the new loan is too high.",
      when: { op: "gt", fact: "debt_service_ratio_after", value: 0.45 },
      effect: "DECLINE",
      reasonCode: "reason.debt_service_ratio",
    },

    // --- Credit bureau -----------------------------------------------------
    {
      key: "bureau_negative_items",
      description: "Recorded payment defaults.",
      when: { op: "gte", fact: "bureau_negative_items", value: 1 },
      effect: "DECLINE",
      reasonCode: "reason.bureau_negative",
    },
    {
      key: "bureau_unavailable",
      description: "The bureau could not be reached; never auto-accept blind.",
      when: { op: "eq", fact: "bureau_status", value: "UNAVAILABLE" },
      effect: "REFER",
      reasonCode: "reason.bureau_unavailable",
    },
    {
      key: "bureau_excellent",
      description: "Bureau score in the top band.",
      when: { op: "gte", fact: "bureau_score", value: 90 },
      effect: "SCORE",
      points: 40,
      reasonCode: "reason.bureau_strong",
    },
    {
      key: "bureau_good",
      description: "Bureau score in the upper middle band.",
      when: { op: "between", fact: "bureau_score", min: 75, max: 89.999 },
      effect: "SCORE",
      points: 20,
      reasonCode: "reason.bureau_good",
    },
    {
      key: "bureau_weak",
      description: "Bureau score below the acceptable band.",
      when: { op: "lt", fact: "bureau_score", value: 60 },
      effect: "SCORE",
      points: -40,
      reasonCode: "reason.bureau_weak",
    },
    {
      key: "bureau_thin_file",
      description: "Too little history to judge; not held against heavily.",
      when: { op: "eq", fact: "bureau_thin_file", value: true },
      effect: "SCORE",
      points: -15,
      reasonCode: "reason.bureau_thin_file",
    },

    // --- Account check (open banking) --------------------------------------
    {
      key: "bank_check_verified",
      description: "Income corroborated by the consented account check.",
      when: { op: "eq", fact: "bank_check_status", value: "VERIFIED" },
      effect: "SCORE",
      points: 25,
      reasonCode: "reason.income_verified",
    },
    {
      key: "bank_income_mismatch",
      description: "Verified income deviates materially from the declared figure.",
      when: { op: "gt", fact: "bank_income_deviation", value: 0.15 },
      effect: "REFER",
      reasonCode: "reason.income_mismatch",
    },
    {
      key: "bank_overdraft_persistent",
      description: "Account overdrawn for a large part of the window.",
      when: { op: "gt", fact: "bank_overdraft_days", value: 45 },
      effect: "SCORE",
      points: -35,
      reasonCode: "reason.persistent_overdraft",
    },
    {
      key: "bank_returned_debits_many",
      description: "Repeated returned direct debits.",
      when: { op: "gte", fact: "bank_returned_debits", value: 4 },
      effect: "DECLINE",
      reasonCode: "reason.returned_debits",
    },
    {
      key: "bank_returned_debits_some",
      description: "A couple of returned direct debits.",
      when: { op: "between", fact: "bank_returned_debits", min: 2, max: 3 },
      effect: "SCORE",
      points: -40,
      reasonCode: "reason.returned_debits",
    },

    // --- Exposure ----------------------------------------------------------
    {
      key: "amount_above_auto_limit",
      description: "Large tickets are always seen by an analyst.",
      when: { op: "gt", fact: "requested_amount", value: 5_000_000 },
      effect: "REFER",
      reasonCode: "reason.amount_review",
    },
    {
      key: "large_amount_self_declared",
      description: "Sizeable loan with no corroborated income.",
      when: {
        op: "and",
        of: [
          { op: "eq", fact: "income_evidence", value: "SELF_DECLARED" },
          { op: "gt", fact: "requested_amount", value: 1_500_000 },
        ],
      },
      effect: "REFER",
      reasonCode: "reason.income_evidence_required",
    },
    {
      key: "co_borrower_present",
      description: "A second liable borrower reduces exposure.",
      when: { op: "eq", fact: "has_co_borrower", value: true },
      effect: "SCORE",
      points: 15,
      reasonCode: "reason.co_borrower",
    },
  ],
};
