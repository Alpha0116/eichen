import { yearFraction } from "./dates";
import type { Minor } from "./money";

export interface CashFlow {
  /** Time offset in years from the drawdown date. */
  t: number;
  /** Positive = paid by the borrower, in minor units. */
  amount: Minor;
}

export interface AprInput {
  /** Amount actually placed at the borrower's disposal, at t = 0. */
  drawdown: Minor;
  /** Charges the borrower pays at drawdown out of their own pocket. */
  upfrontCharges?: Minor;
  flows: readonly CashFlow[];
}

const LOWER_BOUND = -0.9999;
const UPPER_BOUND = 100;
const ITERATIONS = 200;

/**
 * Present value of the borrower's payments minus the credit placed at their
 * disposal, discounted at annual rate `x`. The APR is the root of this
 * function — the equation of Annex I of the EU Consumer Credit Directive,
 * transposed in Germany by PAngV § 6.
 */
function presentValueGap(input: AprInput, x: number): number {
  const discounted = input.flows.reduce(
    (total, flow) => total + flow.amount / Math.pow(1 + x, flow.t),
    0,
  );
  return discounted + (input.upfrontCharges ?? 0) - input.drawdown;
}

/**
 * Effective annual rate (effektiver Jahreszins / TAEG).
 *
 * Solved by bisection rather than Newton–Raphson: the payment stream is
 * monotone in `x` over the bracket, so bisection cannot diverge or land on a
 * spurious root, and 200 halvings of the bracket reach far beyond the precision
 * the figure is ever displayed at.
 *
 * Only mandatory costs may enter this computation. Optional add-ons such as a
 * residual-debt insurance the borrower may decline are excluded by the caller.
 */
export function effectiveAnnualRate(input: AprInput): number {
  if (input.drawdown <= 0) throw new RangeError("drawdown must be positive");
  if (input.flows.length === 0) throw new RangeError("at least one cash flow is required");

  let low = LOWER_BOUND;
  let high = UPPER_BOUND;
  const gapAtLow = presentValueGap(input, low);
  const gapAtHigh = presentValueGap(input, high);

  // A stream whose total is below the drawdown has no non-negative solution:
  // an interest-free loan with no charges is exactly 0 %.
  if (gapAtLow === 0) return low;
  if (gapAtHigh === 0) return high;
  if (gapAtLow > 0 === gapAtHigh > 0) {
    throw new RangeError("no effective rate within the supported bracket");
  }

  for (let i = 0; i < ITERATIONS; i += 1) {
    const mid = (low + high) / 2;
    const gap = presentValueGap(input, mid);
    if (gap > 0 === gapAtLow > 0) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
}

export interface ScheduleLike {
  dueDate: Date;
  payment: Minor;
}

/** Builds the APR cash-flow stream from a repayment plan. */
export function flowsFromSchedule(drawdownDate: Date, entries: readonly ScheduleLike[]): CashFlow[] {
  return entries.map((entry) => ({
    t: yearFraction(drawdownDate, entry.dueDate),
    amount: entry.payment,
  }));
}

/** PAngV requires the effective rate to be published with one decimal place. */
export function formatRatePercent(rate: number, decimals = 2): string {
  return (rate * 100).toFixed(decimals);
}
