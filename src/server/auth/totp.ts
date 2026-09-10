import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238) over HMAC-SHA1, the algorithm every
 * authenticator app implements. Built on node:crypto so no dependency sits
 * between a login and the standard library.
 *
 * Verified against the RFC's own test vectors in tests/unit/totp.test.ts.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP = {
  digits: 6,
  /** Seconds per step. 30 is what authenticator apps assume. */
  periodSeconds: 30,
  /**
   * Steps of clock skew tolerated either side. One step (±30 s) absorbs a
   * badly set phone clock without widening the window an attacker can guess
   * into more than necessary.
   */
  window: 1,
} as const;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bits, matching the HMAC-SHA1 block the algorithm keys with. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepFor(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000 / TOTP.periodSeconds);
}

export function codeForStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step >>> 0, 4);

  const digest = createHmac("sha1", key).update(counter).digest();
  // Dynamic truncation, RFC 4226 § 5.4.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP.digits).padStart(TOTP.digits, "0");
}

export interface VerifyResult {
  valid: boolean;
  /** The step the code belonged to, so a replay of it can be refused. */
  step: number | null;
}

/**
 * Checks a code across the tolerated window.
 *
 * `minStep` refuses any step at or below one already used by this account: a
 * TOTP stays valid for its whole period, so without this a code observed over
 * someone's shoulder could be replayed for the remainder of the window.
 * Comparison is constant-time.
 */
export function verifyCode(
  secret: string,
  code: string,
  options: { at?: Date; minStep?: number | null } = {},
): VerifyResult {
  const normalised = code.replace(/\D/g, "");
  if (normalised.length !== TOTP.digits) return { valid: false, step: null };

  const current = stepFor(options.at ?? new Date());
  const supplied = Buffer.from(normalised, "utf8");

  for (let offset = -TOTP.window; offset <= TOTP.window; offset += 1) {
    const step = current + offset;
    if (options.minStep !== null && options.minStep !== undefined && step <= options.minStep) {
      continue;
    }
    const expected = Buffer.from(codeForStep(secret, step), "utf8");
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      return { valid: true, step };
    }
  }
  return { valid: false, step: null };
}

/**
 * otpauth:// URI an authenticator app scans. The issuer appears twice by
 * convention — as a label prefix and as a parameter — because apps differ in
 * which one they display.
 */
export function otpauthUri(options: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${options.issuer}:${options.account}`);
  const params = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: "SHA1",
    digits: String(TOTP.digits),
    period: String(TOTP.periodSeconds),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Groups the secret for manual entry when a camera is unavailable. */
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
