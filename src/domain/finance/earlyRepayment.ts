import type { AmortisationPlan } from "./annuity";
import { addDays, startOfUtcDay } from "./dates";
import { roundMinor, sumMinor, type Minor } from "./money";

export interface SettlementInput {
  plan: AmortisationPlan;
  nominalAnnualRate: number;
  /** Number of instalments already settled; 0 means nothing paid yet. */
  paidInstalments: number;
  /** Date the borrower intends to repay in full. */
  settlementDate: Date;
  /** Date the loan was paid out, used when no instalment has fallen due yet. */
  drawdownDate: Date;
  /**
   * § 502 (2) BGB switches the compensation off entirely, e.g. when the
   * repayment is covered by a residual-debt insurance or when the contract
   * lacked the mandatory term/termination information.
   */
  compensationWaived?: boolean;
  /** How long the figures stay binding. */
  validForDays?: number;
}

export interface Settlement {
  outstandingPrincipal: Minor;
  /** Interest accrued since the last due date, actual/365. */
  accruedInterest: Minor;
  /** Vorfälligkeitsentschädigung under § 502 BGB. */
  compensation: Minor;
  compensationCapRate: number;
  /** Interest the borrower avoids by repaying now. */
  interestSaved: Minor;
  totalToPay: Minor;
  validUntil: Date;
  remainingTermMonths: number;
  reasons: string[];
}

const MAX_RATE_LONG_TERM = 0.01;
const MAX_RATE_SHORT_TERM = 0.005;
const SHORT_TERM_MONTHS = 12;

/**
 * Early-repayment settlement for a fixed-rate consumer loan.
 *
 * The compensation follows § 502 BGB: at most 1 % of the amount repaid early,
 * at most 0.5 % when less than a year of the agreed term is left, and in no
 * case more than the interest the borrower would still have owed. The binding
 * cap is reported in `reasons` so the figure can be explained to the borrower
 * and audited afterwards.
 */
export function computeSettlement(input: SettlementInput): Settlement {
  const { plan, paidInstalments } = input;
  if (paidInstalments < 0 || paidInstalments > plan.entries.length) {
    throw new RangeError("paidInstalments outside the repayment plan");
  }

  const reasons: string[] = [];
  const outstandingPrincipal =
    paidInstalments === 0 ? plan.financedCapital : plan.entries[paidInstalments - 1].closingBalance;

  const lastEventDate =
    paidInstalments === 0 ? input.drawdownDate : plan.entries[paidInstalments - 1].dueDate;
  const days = Math.max(
    0,
    (startOfUtcDay(input.settlementDate).getTime() - startOfUtcDay(lastEventDate).getTime()) /
      86_400_000,
  );
  const accruedInterest = roundMinor((outstandingPrincipal * input.nominalAnnualRate * days) / 365);

  const remainingEntries = plan.entries.slice(paidInstalments);
  const interestSaved = sumMinor(remainingEntries.map((entry) => entry.interest));
  const remainingTermMonths = remainingEntries.length;

  const compensationCapRate =
    remainingTermMonths <= SHORT_TERM_MONTHS ? MAX_RATE_SHORT_TERM : MAX_RATE_LONG_TERM;

  let compensation = 0;
  if (input.compensationWaived) {
    reasons.push("compensation.waived");
  } else {
    const percentageCap = roundMinor(outstandingPrincipal * compensationCapRate);
    compensation = Math.min(percentageCap, interestSaved);
    reasons.push(
      remainingTermMonths <= SHORT_TERM_MONTHS
        ? "compensation.cap.halfPercent"
        : "compensation.cap.onePercent",
    );
    if (compensation === interestSaved && interestSaved < percentageCap) {
      reasons.push("compensation.cap.remainingInterest");
    }
  }

  return {
    outstandingPrincipal,
    accruedInterest,
    compensation,
    compensationCapRate,
    interestSaved,
    totalToPay: outstandingPrincipal + accruedInterest + compensation,
    validUntil: addDays(input.settlementDate, input.validForDays ?? 14),
    remainingTermMonths,
    reasons,
  };
}
