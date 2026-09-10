import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { recordAudit } from "../audit";
import type { Role } from "./session";
import { formatSecretForDisplay, generateSecret, otpauthUri, verifyCode } from "./totp";

/**
 * Second-factor enrolment and verification.
 *
 * TOTP is fully implemented and available to any account that wants it. Which
 * roles are *obliged* to use it is configuration, and the default is none —
 * every account, staff included, signs in with a password alone.
 *
 * Where an obligation is configured, it is enforced at the session boundary
 * rather than only in the UI: such an account cannot obtain a usable session
 * without the second factor, so there is no window in which a stolen password
 * alone reaches the back office.
 *
 *   EICHEN_MFA_REQUIRED_ROLES="AGENT,RISK,ADMIN"
 *
 * Unknown role names in the variable are ignored rather than throwing: a typo
 * in an environment variable must not take the application down at boot.
 */

const ALL_ROLES: readonly Role[] = ["CUSTOMER", "AGENT", "RISK", "ADMIN"];

/**
 * Read at call time rather than frozen at module load.
 *
 * A constant evaluated on import would bake whatever the environment happened
 * to be when the first module touched this file — untestable, and surprising
 * for anyone who changes the variable and restarts only part of a process.
 * The parse is a split of a short string, and it exits immediately when the
 * variable is unset, which is the default.
 */
export function mfaRequiredRoles(): readonly Role[] {
  const raw = process.env.EICHEN_MFA_REQUIRED_ROLES;
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is Role => (ALL_ROLES as readonly string[]).includes(value));
}

export function mfaRequiredFor(role: Role): boolean {
  return mfaRequiredRoles().includes(role);
}

const RECOVERY_CODE_COUNT = 8;
const MAX_MFA_ATTEMPTS = 6;
const LOCK_MINUTES = 15;
const ISSUER = "Eichen";

function hashRecoveryCode(code: string): string {
  // Recovery codes carry ~50 bits of entropy from a random generator, so a
  // single SHA-256 is sufficient here — unlike a user-chosen password, there
  // is nothing to brute-force cheaply.
  return createHash("sha256").update(code.replace(/\s|-/g, "").toUpperCase(), "utf8").digest("hex");
}

/** Unambiguous alphabet: no O/0, I/1, S/5 — these get read out over the phone. */
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";

function newRecoveryCode(): string {
  let body = "";
  for (let i = 0; i < 10; i += 1) body += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  return `${body.slice(0, 5)}-${body.slice(5)}`;
}

export interface EnrolmentOffer {
  secret: string;
  secretForDisplay: string;
  otpauthUri: string;
}

/**
 * Starts (or restarts) enrolment.
 *
 * The candidate secret is held in `mfaPendingSecret` and never becomes the
 * active one until a code proves the authenticator actually has it. Restarting
 * simply replaces the candidate, so abandoning a half-finished setup cannot
 * leave an account unable to log in.
 */
export async function beginEnrolment(userId: string): Promise<EnrolmentOffer> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateSecret();

  await db.user.update({ where: { id: userId }, data: { mfaPendingSecret: secret } });

  return {
    secret,
    secretForDisplay: formatSecretForDisplay(secret),
    otpauthUri: otpauthUri({ secret, account: user.email, issuer: ISSUER }),
  };
}

export type EnrolmentResult =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; reason: "NO_PENDING_SECRET" | "INVALID_CODE" };

/**
 * Confirms enrolment and issues recovery codes.
 *
 * The codes are returned in the clear exactly once — only their hashes are
 * stored — because a recovery code the server can still read is not a recovery
 * code, it is a second password sitting in the database.
 */
export async function confirmEnrolment(
  userId: string,
  code: string,
): Promise<EnrolmentResult> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaPendingSecret) return { ok: false, reason: "NO_PENDING_SECRET" };

  const result = verifyCode(user.mfaPendingSecret, code, { minStep: null });
  if (!result.valid) return { ok: false, reason: "INVALID_CODE" };

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);

  await db.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({
      data: codes.map((value) => ({ userId, codeHash: hashRecoveryCode(value) })),
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        mfaSecret: user.mfaPendingSecret,
        mfaPendingSecret: null,
        mfaEnabled: true,
        mfaEnrolledAt: new Date(),
        mfaLastStep: result.step,
        mfaFailedAttempts: 0,
      },
    });
  });

  await recordAudit({
    applicationId: null,
    action: "application_updated",
    actorType: "AGENT",
    actorId: userId,
    payload: { event: "mfa_enrolled", recoveryCodes: RECOVERY_CODE_COUNT },
  });

  return { ok: true, recoveryCodes: codes };
}

export type ChallengeResult =
  | { ok: true; usedRecoveryCode: boolean; remainingRecoveryCodes: number }
  | { ok: false; reason: "NOT_ENROLLED" | "INVALID_CODE" | "LOCKED"; minutes?: number };

/**
 * Verifies a second factor at login.
 *
 * Accepts either a TOTP code or an unused recovery code. A used TOTP step is
 * recorded so the same code cannot be presented twice inside its window, and a
 * spent recovery code is marked rather than deleted, so the fact that it was
 * used stays on the record.
 */
export async function verifyChallenge(userId: string, code: string): Promise<ChallengeResult> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      ok: false,
      reason: "LOCKED",
      minutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
    };
  }
  if (!user.mfaEnabled || !user.mfaSecret) return { ok: false, reason: "NOT_ENROLLED" };

  const totp = verifyCode(user.mfaSecret, code, { minStep: user.mfaLastStep });
  if (totp.valid) {
    await db.user.update({
      where: { id: userId },
      data: { mfaLastStep: totp.step, mfaFailedAttempts: 0, lockedUntil: null },
    });
    const remaining = await db.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
    return { ok: true, usedRecoveryCode: false, remainingRecoveryCodes: remaining };
  }

  const candidate = hashRecoveryCode(code);
  const stored = await db.mfaRecoveryCode.findMany({ where: { userId, usedAt: null } });
  const match = stored.find((row) => {
    const a = Buffer.from(row.codeHash, "hex");
    const b = Buffer.from(candidate, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });

  if (match) {
    await db.mfaRecoveryCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
    await db.user.update({
      where: { id: userId },
      data: { mfaFailedAttempts: 0, lockedUntil: null },
    });
    await recordAudit({
      applicationId: null,
      action: "application_updated",
      actorType: "AGENT",
      actorId: userId,
      payload: { event: "mfa_recovery_code_used" },
    });
    const remaining = await db.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
    return { ok: true, usedRecoveryCode: true, remainingRecoveryCodes: remaining };
  }

  const attempts = user.mfaFailedAttempts + 1;
  await db.user.update({
    where: { id: userId },
    data: {
      mfaFailedAttempts: attempts,
      lockedUntil:
        attempts >= MAX_MFA_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
    },
  });

  return attempts >= MAX_MFA_ATTEMPTS
    ? { ok: false, reason: "LOCKED", minutes: LOCK_MINUTES }
    : { ok: false, reason: "INVALID_CODE" };
}

/** Only a customer may switch their second factor off; staff may not. */
export async function disableMfa(userId: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (mfaRequiredFor(user.role as Role)) {
    throw new Error("Multi-factor authentication is mandatory for this role");
  }

  await db.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaPendingSecret: null,
        mfaEnabled: false,
        mfaEnrolledAt: null,
        mfaLastStep: null,
      },
    });
  });

  await recordAudit({
    applicationId: null,
    action: "application_updated",
    actorType: "CUSTOMER",
    actorId: userId,
    payload: { event: "mfa_disabled" },
  });
}

export async function remainingRecoveryCodes(userId: string): Promise<number> {
  return db.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
}

