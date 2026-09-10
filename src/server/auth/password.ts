import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from the standard library.
 *
 * scrypt is memory-hard and needs no native module, which keeps the install
 * free of a compiler step. Parameters are stored inside the hash string, so
 * raising the cost later does not invalidate existing passwords: an old hash
 * still verifies against its own parameters and can be re-hashed on next login.
 */
const KEY_LENGTH = 64;
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export interface PasswordIssue {
  code: "too_short" | "too_common";
}

/** Common passwords that a length rule alone would let through. */
const BANNED = new Set([
  "passwort1234",
  "password1234",
  "123456789012",
  "qwertzuiopas",
  "eichenkredit",
]);

export function validatePassword(password: string): PasswordIssue | null {
  if (password.length < MIN_PASSWORD_LENGTH) return { code: "too_short" };
  if (BANNED.has(password.toLowerCase())) return { code: "too_common" };
  return null;
}
