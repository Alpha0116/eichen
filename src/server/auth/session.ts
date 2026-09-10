import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "../db";

export const SESSION_COOKIE = "eichen_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A half-finished login is short-lived by design. */
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;
/** How stale `lastSeenAt` may get before it is worth another write. */
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export type Role = "CUSTOMER" | "AGENT" | "RISK" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  locale: string;
  firstName: string | null;
  lastName: string | null;
  mfaEnabled: boolean;
  /** Set until the account has replaced a password somebody else chose for it. */
  mustChangePassword: boolean;
}

/**
 * Only the SHA-256 of the session token is stored. A database dump therefore
 * does not hand out live sessions, and the token itself exists solely in the
 * user's HttpOnly cookie.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Hashed with the deployment secret so the log cannot be reversed to an IP. */
function fingerprint(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "dev"}|${value}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

/**
 * Creates a session.
 *
 * `mfaPending` marks a session that has passed the password but not the second
 * factor. It authenticates nobody until promoted, and it expires in minutes
 * rather than days — an unfinished login should not leave a usable artefact
 * lying around for a week.
 */
export async function createSession(
  userId: string,
  options: { mfaPending?: boolean } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const headerBag = await headers();
  const pending = options.mfaPending ?? false;

  await db.session.create({
    data: {
      userId,
      mfaPending: pending,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + (pending ? MFA_CHALLENGE_TTL_MS : SESSION_TTL_MS)),
      userAgentHash: fingerprint(headerBag.get("user-agent")),
      ipHash: fingerprint(headerBag.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null),
    },
  });

  const cookieBag = await cookies();
  cookieBag.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: (pending ? MFA_CHALLENGE_TTL_MS : SESSION_TTL_MS) / 1000,
  });
}

/**
 * The user behind a session that is still waiting for its second factor.
 * Only the MFA challenge and enrolment pages may act on this.
 */
export async function getPendingMfaUser(): Promise<(SessionUser & { mfaEnabled: boolean }) | null> {
  const cookieBag = await cookies();
  const token = cookieBag.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || !session.mfaPending || session.expiresAt < new Date()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role as Role,
    locale: session.user.locale,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    mfaEnabled: session.user.mfaEnabled,
    mustChangePassword: session.user.mustChangePassword,
  };
}

/** Promotes a pending session to a full one once the second factor is proven. */
export async function completeMfaChallenge(): Promise<boolean> {
  const cookieBag = await cookies();
  const token = cookieBag.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({ where: { tokenHash } });
  if (!session || !session.mfaPending || session.expiresAt < new Date()) return false;

  await db.session.update({
    where: { tokenHash },
    data: { mfaPending: false, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });

  cookieBag.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieBag = await cookies();
  const token = cookieBag.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  // A session awaiting its second factor authenticates nobody. This is the
  // single check that makes MFA mandatory rather than advisory: every guard in
  // the application goes through here.
  if (!session || session.mfaPending || session.expiresAt < new Date()) return null;

  // Sliding expiry, but written at most every quarter of an hour: refreshing on
  // every request would turn each page view into a write.
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role as Role,
    locale: session.user.locale,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    mfaEnabled: session.user.mfaEnabled,
    mustChangePassword: session.user.mustChangePassword,
  };
}

export async function destroySession(): Promise<void> {
  const cookieBag = await cookies();
  const token = cookieBag.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieBag.delete(SESSION_COOKIE);
}

/** Removes every session of a user, e.g. after a password change. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export const STAFF_ROLES: readonly Role[] = ["AGENT", "RISK", "ADMIN"];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}
