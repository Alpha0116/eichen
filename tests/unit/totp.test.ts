import assert from "node:assert/strict";
import { test } from "node:test";
import {
  base32Decode,
  base32Encode,
  codeForStep,
  formatSecretForDisplay,
  generateSecret,
  otpauthUri,
  stepFor,
  verifyCode,
} from "../../src/server/auth/totp";

/**
 * The RFC 6238 test vectors, which are the only real check that this
 * implementation agrees with every authenticator app in existence.
 *
 * The RFC publishes eight digits; the product uses six, so the expected value
 * is the last six of each.
 */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

const VECTORS: { time: number; eightDigits: string }[] = [
  { time: 59, eightDigits: "94287082" },
  { time: 1111111109, eightDigits: "07081804" },
  { time: 1111111111, eightDigits: "14050471" },
  { time: 1234567890, eightDigits: "89005924" },
  { time: 2000000000, eightDigits: "69279037" },
  { time: 20000000000, eightDigits: "65353130" },
];

test("matches the RFC 6238 SHA-1 test vectors", () => {
  for (const vector of VECTORS) {
    const step = Math.floor(vector.time / 30);
    assert.equal(
      codeForStep(RFC_SECRET, step),
      vector.eightDigits.slice(-6),
      `mismatch at T=${vector.time}`,
    );
  }
});

test("base32 round-trips arbitrary bytes", () => {
  for (const sample of ["", "a", "ab", "abc", "abcd", "abcde", "hello world"]) {
    const buffer = Buffer.from(sample, "utf8");
    assert.deepEqual(base32Decode(base32Encode(buffer)), buffer);
  }
});

test("base32 decoding ignores padding, spaces and case", () => {
  const secret = generateSecret();
  const messy = formatSecretForDisplay(secret).toLowerCase() + "====";
  assert.deepEqual(base32Decode(messy), base32Decode(secret));
});

test("a generated secret is 160 bits", () => {
  assert.equal(base32Decode(generateSecret()).length, 20);
});

test("accepts the current code and rejects a wrong one", () => {
  const secret = generateSecret();
  const now = new Date();
  const code = codeForStep(secret, stepFor(now));

  assert.equal(verifyCode(secret, code, { at: now }).valid, true);
  assert.equal(verifyCode(secret, "000000", { at: now }).valid, false);
  assert.equal(verifyCode(secret, "12345", { at: now }).valid, false);
  assert.equal(verifyCode(secret, "abcdef", { at: now }).valid, false);
});

test("tolerates one step of clock skew but no more", () => {
  const secret = generateSecret();
  const now = new Date();
  const step = stepFor(now);

  assert.equal(verifyCode(secret, codeForStep(secret, step - 1), { at: now }).valid, true);
  assert.equal(verifyCode(secret, codeForStep(secret, step + 1), { at: now }).valid, true);
  assert.equal(verifyCode(secret, codeForStep(secret, step - 2), { at: now }).valid, false);
  assert.equal(verifyCode(secret, codeForStep(secret, step + 2), { at: now }).valid, false);
});

test("refuses to accept a code from a step already used", () => {
  const secret = generateSecret();
  const now = new Date();
  const step = stepFor(now);
  const code = codeForStep(secret, step);

  const first = verifyCode(secret, code, { at: now, minStep: null });
  assert.equal(first.valid, true);
  assert.equal(first.step, step);

  // Replaying the same code inside its own 30-second window must fail.
  const replay = verifyCode(secret, code, { at: now, minStep: first.step });
  assert.equal(replay.valid, false);
});

test("the otpauth URI carries the parameters an authenticator needs", () => {
  const uri = otpauthUri({ secret: "ABCDEFGH", account: "agent@eichen-kredit.com", issuer: "Eichen" });
  const parsed = new URL(uri);

  assert.equal(parsed.protocol, "otpauth:");
  assert.equal(decodeURIComponent(parsed.pathname), "/Eichen:agent@eichen-kredit.com");
  assert.equal(parsed.searchParams.get("secret"), "ABCDEFGH");
  assert.equal(parsed.searchParams.get("issuer"), "Eichen");
  assert.equal(parsed.searchParams.get("algorithm"), "SHA1");
  assert.equal(parsed.searchParams.get("digits"), "6");
  assert.equal(parsed.searchParams.get("period"), "30");
});
