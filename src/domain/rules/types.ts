import type { Condition, Facts } from "./conditions";

export type RuleEffect = "DECLINE" | "REFER" | "SCORE";

export interface Rule {
  key: string;
  /** Internal, non-customer-facing description. */
  description: string;
  when: Condition;
  effect: RuleEffect;
  /** Score delta when `effect` is SCORE. Negative values penalise. */
  points?: number;
  /**
   * Stable code resolved to a borrower-facing sentence in the dictionaries.
   * Never expose the raw rule key to an applicant.
   */
  reasonCode: string;
  /** Set to false to keep a rule in the set without letting it fire. */
  enabled?: boolean;
}

export interface ScoreBand {
  /** Inclusive lower bound. */
  minScore: number;
  grade: string;
  /** Added to the lender's base rate, in decimal (0.015 = +1.5 pp). */
  rateSpread: number;
  /** Share of the requested amount this band may borrow, 0–1. */
  maxAmountFactor: number;
}

export interface AffordabilityConfig {
  /** Monthly living allowance for the first adult, in minor units. */
  baseAllowanceFirstAdult: number;
  baseAllowancePerAdditionalAdult: number;
  baseAllowancePerChild: number;
  /** Share of disposable income that may go to the new instalment, 0–1. */
  maxInstalmentShareOfDisposable: number;
  /** Hard ceiling on total debt service over net income, 0–1. */
  maxDebtServiceRatio: number;
}

export interface RuleSet {
  key: string;
  version: number;
  /** Country this set applies to, ISO 3166-1 alpha-2. */
  country: string;
  currency: string;
  publishedAt: string;
  baseScore: number;
  minScoreToAccept: number;
  minScoreToRefer: number;
  bands: ScoreBand[];
  affordability: AffordabilityConfig;
  rules: Rule[];
}

export type DecisionOutcome = "ACCEPT" | "REFER" | "DECLINE";

export interface FiredRule {
  key: string;
  effect: RuleEffect;
  reasonCode: string;
  points: number;
}

export interface Decision {
  outcome: DecisionOutcome;
  score: number;
  band: ScoreBand | null;
  ruleSetKey: string;
  ruleSetVersion: number;
  firedRules: FiredRule[];
  /** The few drivers that moved the score most, for the explanation notice. */
  principalReasonCodes: string[];
  /** Snapshot of every input, so the decision stays reproducible. */
  facts: Facts;
  evaluatedAt: string;
}
