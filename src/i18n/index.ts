import { de, type Dictionary } from "./dictionaries/de";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

const DICTIONARIES: Record<Locale, Dictionary> = { de };

export function getDictionary(locale: string): Dictionary {
  return DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

/**
 * Substitutes {placeholders}. A placeholder with no matching variable is left
 * as-is rather than blanked, so a missing value shows up in review instead of
 * producing a sentence with a hole in it.
 */
export function interpolate(template: string, variables: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in variables ? String(variables[key]) : match,
  );
}

export * from "./config";
export type { Dictionary };
