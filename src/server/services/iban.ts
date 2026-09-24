/**
 * IBAN handling: checking and masking the borrower's payout account, and
 * composing the account-space IBANs shown on step 5.
 *
 * An IBAN is never logged and never written to the audit trail.
 */

/** Length by country, for the ones this product accepts. */
const IBAN_LENGTHS: Record<string, number> = {
  DE: 22,
  AT: 20,
  CH: 21,
  FR: 27,
  BE: 16,
  NL: 18,
  LU: 20,
  IT: 27,
  ES: 24,
};

/** Spaces and dashes out, letters up: the form an IBAN is compared and stored in. */
export function normaliseIban(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

const normalise = normaliseIban;

/**
 * ISO 13616 check digits, computed on the rearranged string with letters
 * expanded to two digits. The modulo is taken in chunks because the number is
 * far wider than a JavaScript integer, and a `Number()` on the whole string
 * would silently lose precision and accept invalid accounts.
 */
function checksumValid(iban: string): boolean {
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

function mod97(rearranged: string): number {
  let remainder = 0;
  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    const chunk =
      code >= 65 && code <= 90
        ? String(code - 55) // A→10 … Z→35
        : character;
    if (!/^\d+$/.test(chunk)) return -1;
    for (const digit of chunk) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder;
}

/**
 * A complete IBAN for a country and a BBAN, with the check digits worked out
 * — so a number made up here passes the same test as one typed by a person.
 */
export function ibanFrom(country: string, bban: string): string {
  const check = 98 - mod97(`${bban}${country}00`);
  return `${country}${String(check).padStart(2, "0")}${bban}`;
}

/** Groups of four, the way an IBAN is printed. */
export function formatIban(value: string): string {
  return normalise(value).replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * Returns the masked form, or null when the value is not a valid IBAN.
 *
 * The mask keeps the country prefix and the last four digits — enough for the
 * borrower to recognise their own account on screen, not enough to pay from
 * it.
 */
export function maskIban(value: string): string | null {
  const iban = normalise(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return null;

  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return null;
  if (iban.length < 15 || iban.length > 34) return null;
  if (!checksumValid(iban)) return null;

  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}
