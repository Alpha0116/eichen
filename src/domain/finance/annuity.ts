import { addMonths } from "./dates";
import { assertMinor, roundMinor, sumMinor, type Minor } from "./money";

export interface LoanTerms {
  /** Net amount actually paid out to the borrower (Nettodarlehensbetrag). */
  netAmount: Minor;
  /**
   * Charges added to the borrowed capital instead of being paid up front,
   * typically a financed residual-debt insurance premium.
   */
  financedCharges: Minor;
  /** Nominal borrowing rate per year (Sollzins), as a decimal: 0.089 = 8.9 %. */
  nominalAnnualRate: number;
  termMonths: number;
  firstDueDate: Date;
}

export interface ScheduleEntry {
  index: number;
  dueDate: Date;
  openingBalance: Minor;
  payment: Minor;
  interest: Minor;
  principal: Minor;
  closingBalance: Minor;
}

export interface AmortisationPlan {
  /** Capital the interest is computed on: net amount plus financed charges. */
  financedCapital: Minor;
  monthlyRate: number;
  /** Level instalment; the final entry may differ by a few cents. */
  instalment: Minor;
  finalInstalment: Minor;
  entries: ScheduleEntry[];
  totalInterest: Minor;
  /** Sum of every instalment (Gesamtbetrag). */
  totalPayable: Minor;
}

export function monthlyRateOf(nominalAnnualRate: number): number {
  return nominalAnnualRate / 12;
}

/**
 * Level annuity instalment, rounded half-up to the minor unit.
 *
 * The rounded instalment must strictly exceed the first period's interest,
 * otherwise the balance would never amortise; in that (degenerate) case the
 * instalment is bumped by one minor unit.
 */
export function annuityInstalment(capital: Minor, monthlyRate: number, termMonths: number): Minor {
  assertMinor(capital, "capital");
  if (termMonths <= 0) throw new RangeError("termMonths must be positive");
  if (capital <= 0) return 0;

  const raw =
    monthlyRate === 0
      ? capital / termMonths
      : (capital * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  let instalment = roundMinor(raw);
  const firstInterest = roundMinor(capital * monthlyRate);
  if (termMonths > 1 && instalment <= firstInterest) instalment = firstInterest + 1;
  return instalment;
}

/**
 * Builds the full repayment plan. Interest accrues on the outstanding balance
 * at the monthly rate and is rounded per period, which is how consumer lenders
 * present the Tilgungsplan; the closing instalment absorbs the rounding drift
 * so the balance lands exactly on zero.
 */
export function buildAmortisationPlan(terms: LoanTerms): AmortisationPlan {
  const financedCapital = assertMinor(terms.netAmount) + assertMinor(terms.financedCharges);
  const monthlyRate = monthlyRateOf(terms.nominalAnnualRate);
  const instalment = annuityInstalment(financedCapital, monthlyRate, terms.termMonths);

  const entries: ScheduleEntry[] = [];
  let balance = financedCapital;

  for (let index = 1; index <= terms.termMonths; index += 1) {
    const openingBalance = balance;
    const interest = roundMinor(openingBalance * monthlyRate);
    const isLast = index === terms.termMonths;

    let principal = instalment - interest;
    if (isLast || principal >= openingBalance) principal = openingBalance;

    const payment = principal + interest;
    balance = openingBalance - principal;

    entries.push({
      index,
      dueDate: addMonths(terms.firstDueDate, index - 1),
      openingBalance,
      payment,
      interest,
      principal,
      closingBalance: balance,
    });

    if (balance === 0 && !isLast) break;
  }

  const totalInterest = sumMinor(entries.map((entry) => entry.interest));
  const totalPayable = sumMinor(entries.map((entry) => entry.payment));

  return {
    financedCapital,
    monthlyRate,
    instalment,
    finalInstalment: entries.length > 0 ? entries[entries.length - 1].payment : 0,
    entries,
    totalInterest,
    totalPayable,
  };
}
