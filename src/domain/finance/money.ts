/**
 * Monetary amounts are handled exclusively as integers in the currency's minor
 * unit (cents for EUR/CHF, Rappen, etc.). Floating point is used only for
 * rates and for the APR solver, never to carry a balance.
 */

export type CurrencyCode = "EUR" | "CHF" | "PLN";

export interface CurrencyDef {
  code: CurrencyCode;
  /** Number of decimal digits in the minor unit. */
  exponent: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  EUR: { code: "EUR", exponent: 2 },
  CHF: { code: "CHF", exponent: 2 },
  PLN: { code: "PLN", exponent: 2 },
};

/** Amount in minor units. Always an integer. */
export type Minor = number;

export function assertMinor(value: number, label = "amount"): Minor {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer in minor units, got ${value}`);
  }
  return value;
}

/**
 * Half-up rounding, the convention used for consumer instalments: 0.5 cent
 * always rounds away from zero so that a schedule never silently under-collects.
 */
export function roundMinor(value: number): Minor {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function majorToMinor(major: number, currency: CurrencyCode = "EUR"): Minor {
  const factor = 10 ** CURRENCIES[currency].exponent;
  return roundMinor(major * factor);
}

export function minorToMajor(minor: Minor, currency: CurrencyCode = "EUR"): number {
  const factor = 10 ** CURRENCIES[currency].exponent;
  return minor / factor;
}

export function sumMinor(values: readonly Minor[]): Minor {
  return values.reduce<Minor>((total, value) => total + value, 0);
}
