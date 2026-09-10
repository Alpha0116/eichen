/** Adds `months` calendar months, clamping the day to the end of the target month. */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Actual/365 fraction between two dates, used by the APR solver when a cash
 * flow does not fall on a whole month boundary.
 */
export function yearFraction(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / msPerDay / 365;
}

/**
 * First instalment date: exactly one calendar month after drawdown.
 *
 * The repayment plan accrues one month of interest per period, so the periods
 * and the calendar have to agree. Pushing the first instalment to, say, the 1st
 * of the following month would hand the borrower a shorter or longer first
 * period than the interest charged for it, and the effective rate would drift
 * away from the nominal rate for no economic reason. A lender that wants a
 * fixed billing day charges interim interest for the stub period instead —
 * that variant is not modelled here.
 */
export function defaultFirstDueDate(disbursedAt: Date): Date {
  return addMonths(disbursedAt, 1);
}
