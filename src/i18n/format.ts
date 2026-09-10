import { CURRENCIES, type CurrencyCode, type Minor } from "../domain/finance/money";
import { INTL_LOCALES, type Locale } from "./config";

/**
 * Formatting helpers.
 *
 * Every one of them takes the locale explicitly. Nothing here reads a global or
 * the machine's locale: a German page rendered on a French developer's laptop
 * must still print 1.234,56 €.
 */

export function formatMoney(
  minor: Minor,
  locale: Locale,
  currency: CurrencyCode = "EUR",
  options: { showDecimals?: boolean } = {},
): string {
  const exponent = CURRENCIES[currency].exponent;
  const showDecimals = options.showDecimals ?? true;
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: showDecimals ? exponent : 0,
    maximumFractionDigits: showDecimals ? exponent : 0,
  }).format(minor / 10 ** exponent);
}

/** Rates are stored as decimals (0.0689) and shown as percentages (6,89 %). */
export function formatPercent(rate: number, locale: Locale, decimals = 2): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rate);
}

export function formatNumber(value: number, locale: Locale, decimals = 0): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | string, locale: Locale): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

export function formatMonthYear(date: Date | string, locale: Locale): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
