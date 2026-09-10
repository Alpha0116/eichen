/**
 * Typed access to the String columns that hold JSON.
 *
 * SQLite has no JSON scalar in Prisma, so payloads are stored as text. Parsing
 * is centralised here and always total: a corrupt or legacy payload returns the
 * fallback instead of throwing inside a page render.
 */
export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Revives ISO date strings that were serialised out of Date objects. Applied to
 * the stored repayment plans, whose due dates must come back as Dates.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function fromJsonWithDates<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value, (_key, item: unknown) =>
      typeof item === "string" && ISO_DATE.test(item) ? new Date(item) : item,
    ) as T;
  } catch {
    return fallback;
  }
}
