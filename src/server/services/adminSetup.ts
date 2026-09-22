import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { recordAudit } from "../audit";
import { hashPassword, validatePassword } from "../auth/password";
import { CONTACT } from "../config";
import { db } from "../db";
import { notify } from "./notifications";
import type { Locale } from "../../i18n";

/**
 * Opening an administrator account from the site itself.
 *
 * The scripts that create administrators need a shell on the database, which
 * production does not offer. This is the alternative: a public page where the
 * account is described, and a six-digit code sent to the operations mailbox
 * that must be typed back before anything is created. Anybody can reach the
 * page; only whoever reads that mailbox can finish, which is the same trust
 * the rest of the back office already places in it.
 *
 * Every step is bounded — one code per request, a short life, few attempts,
 * few requests an hour — so the page cannot be used to guess its way in or to
 * flood the mailbox.
 */

export const CODE_TTL_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

/**
 * SHA-256 of the setup key that opens the very first account without a
 * mailed code — the way in when no mail can leave the server yet and nobody
 * can reach the hosting account to change that. Only the digest is here; the
 * key itself is with whoever set the site up. It is accepted solely while no
 * administrator exists: the moment one does, it is inert, whoever holds it.
 */
const BOOTSTRAP_KEY_SHA256 = "863bee017f23b45587d6c83e8a0b1368114e4a62102b7b15646e24b09d8e15b6";

export type AdminSetupError =
  | "validation"
  | "passwordMismatch"
  | "passwordTooShort"
  | "passwordTooCommon"
  | "emailTaken"
  | "tooManyRequests"
  | "codeInvalid"
  | "codeExpired"
  | "bootstrapKeyInvalid"
  | "bootstrapClosed";

export class AdminSetupRejected extends Error {
  constructor(public readonly code: AdminSetupError) {
    super(code);
    this.name = "AdminSetupRejected";
  }
}

function hashCode(inviteId: string, code: string): string {
  return createHash("sha256").update(`${inviteId}|${code}`, "utf8").digest("hex");
}

export interface RequestAdminInput {
  email: string;
  firstName: string | null;
  lastName: string | null;
  password: string;
  passwordRepeat: string;
  locale: Locale;
}

function bootstrapKeyMatches(key: string): boolean {
  const expected = Buffer.from(BOOTSTRAP_KEY_SHA256, "hex");
  const given = createHash("sha256").update(key.trim(), "utf8").digest();
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The checks both ways in share: the password is sound and the address free. */
async function validateAccount(input: RequestAdminInput): Promise<string> {
  if (input.password !== input.passwordRepeat) throw new AdminSetupRejected("passwordMismatch");
  const issue = validatePassword(input.password);
  if (issue) {
    throw new AdminSetupRejected(issue.code === "too_short" ? "passwordTooShort" : "passwordTooCommon");
  }
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AdminSetupRejected("emailTaken");
  }
  return email;
}

async function createAdmin(input: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  passwordHash: string;
  /** What vouched for the account: the mailbox that read the code, or the setup key. */
  confirmedVia: string;
}) {
  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      role: "ADMIN",
      locale: "de",
      firstName: input.firstName,
      lastName: input.lastName,
      // Chosen by its owner on the request form: nobody else knows it.
      mustChangePassword: false,
    },
  });
  await recordAudit({
    applicationId: null,
    action: "admin_account_created",
    actorType: "SYSTEM",
    actorId: user.id,
    payload: { email: user.email, confirmedVia: input.confirmedVia },
  });
  return user;
}

/**
 * Opens the first administrator account against the setup key, no mail
 * involved. Refused outright once any administrator exists, before the key
 * is even looked at, so it cannot be used to add a second one.
 */
export async function bootstrapAdminAccount(
  input: RequestAdminInput & { bootstrapKey: string },
): Promise<{ email: string }> {
  if ((await db.user.count({ where: { role: "ADMIN" } })) > 0) {
    throw new AdminSetupRejected("bootstrapClosed");
  }
  if (!bootstrapKeyMatches(input.bootstrapKey)) throw new AdminSetupRejected("bootstrapKeyInvalid");

  const email = await validateAccount(input);
  const user = await createAdmin({
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash: await hashPassword(input.password),
    confirmedVia: "setup-key",
  });
  return { email: user.email };
}

/**
 * Records the account to be opened and sends the code that unlocks it.
 *
 * Returns the invite's id, which the confirmation step carries; the code
 * itself leaves only by mail. Where the mail goes is not the caller's choice:
 * it is the operations address, whatever the form said.
 */
export async function requestAdminAccount(input: RequestAdminInput): Promise<{ inviteId: string }> {
  const email = await validateAccount(input);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.adminInvite.count({ where: { createdAt: { gt: hourAgo } } });
  if (recent >= MAX_REQUESTS_PER_HOUR) throw new AdminSetupRejected("tooManyRequests");

  // A fresh request replaces any earlier one for the same address, so there
  // is never more than one live code per account being opened.
  await db.adminInvite.deleteMany({ where: { email } });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const invite = await db.adminInvite.create({
    data: {
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(input.password),
      codeHash: "",
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });
  await db.adminInvite.update({
    where: { id: invite.id },
    data: { codeHash: hashCode(invite.id, code) },
  });

  await notify({
    applicationId: null,
    channel: "EMAIL",
    to: CONTACT.opsEmail,
    template: "admin_setup_code",
    locale: input.locale,
    variables: {
      code,
      email,
      name: [input.firstName, input.lastName].filter(Boolean).join(" ") || "—",
      minutes: String(CODE_TTL_MINUTES),
    },
  });

  return { inviteId: invite.id };
}

/**
 * Turns an invite into an account when the code matches.
 *
 * A wrong code counts against the invite; on the last one the invite is gone
 * and the form starts over. Whether the code was wrong or the invite is
 * missing reads the same from outside, so the id cannot be used to probe.
 */
export async function confirmAdminAccount(inviteId: string, code: string): Promise<{ email: string }> {
  const invite = await db.adminInvite.findUnique({ where: { id: inviteId } });
  if (!invite) throw new AdminSetupRejected("codeInvalid");

  if (invite.expiresAt < new Date()) {
    await db.adminInvite.delete({ where: { id: invite.id } });
    throw new AdminSetupRejected("codeExpired");
  }

  const expected = Buffer.from(invite.codeHash, "hex");
  const given = Buffer.from(hashCode(invite.id, code.trim()), "hex");
  const matches = expected.length === given.length && timingSafeEqual(expected, given);

  if (!matches) {
    if (invite.attempts + 1 >= MAX_ATTEMPTS) {
      await db.adminInvite.delete({ where: { id: invite.id } });
      throw new AdminSetupRejected("codeExpired");
    }
    await db.adminInvite.update({ where: { id: invite.id }, data: { attempts: { increment: 1 } } });
    throw new AdminSetupRejected("codeInvalid");
  }

  // Checked again here: an account may have appeared under this address in
  // the minutes between the request and the code.
  if (await db.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
    await db.adminInvite.delete({ where: { id: invite.id } });
    throw new AdminSetupRejected("emailTaken");
  }

  const user = await createAdmin({
    email: invite.email,
    firstName: invite.firstName,
    lastName: invite.lastName,
    passwordHash: invite.passwordHash,
    confirmedVia: CONTACT.opsEmail,
  });
  await db.adminInvite.delete({ where: { id: invite.id } });

  return { email: user.email };
}
