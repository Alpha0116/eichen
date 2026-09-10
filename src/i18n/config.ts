export const LOCALES = ["de"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * German is the only language the product is published in.
 *
 * The routing segment stays: every page still lives under /{locale}, so a
 * second language is a dictionary and an entry in this list rather than a
 * change to every URL in the application.
 */
export const DEFAULT_LOCALE: Locale = "de";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Narrows a stored language to one that is still published.
 *
 * Rows written while another language existed keep whatever they were saved
 * with. Reading one back must give a locale that the dictionaries and the
 * contract wording actually have, otherwise a document generated for an old
 * file fails on a missing translation rather than simply coming out in German.
 */
export function toLocale(value: string): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tags used for Intl formatting, distinct from the routing segment. */
export const INTL_LOCALES: Record<Locale, string> = {
  de: "de-DE",
};
