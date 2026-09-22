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

export type AdminSetupError =
  | "validation"
  | "passwordMismatch"
  | "passwordTooShort"
  | "passwordTooCommon"
  | "emailTaken"
  | "tooManyRequests"
  | "codeInvalid"
  | "codeExpired";

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

/**
 * Records the account to be opened and sends the code that unlocks it.
 *
 * Returns the invite's id, which the confirmation step carries; the code
 * itself leaves only by mail. Where the mail goes is not the caller's choice:
 * it is the operations address, whatever the form said.
 */
export async function requestAdminAccount(input: RequestAdminInput): Promise<{ inviteId: string }> {
  if (input.password !== input.passwordRepeat) throw new AdminSetupRejected("passwordMismatch");
  const issue = validatePassword(input.password);
  if (issue) {
    throw new AdminSetupRejected(issue.code === "too_short" ? "passwordTooShort" : "passwordTooCommon");
  }

  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AdminSetupRejected("emailTaken");
  }

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

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invite.email,
        passwordHash: invite.passwordHash,
        role: "ADMIN",
        locale: "de",
        firstName: invite.firstName,
        lastName: invite.lastName,
        // Chosen by its owner on the request form: nobody else knows it.
        mustChangePassword: false,
      },
    });
    await tx.adminInvite.delete({ where: { id: invite.id } });
    return created;
  });

  await recordAudit({
    applicationId: null,
    action: "admin_account_created",
    actorType: "SYSTEM",
    actorId: user.id,
    payload: { email: user.email, confirmedVia: CONTACT.opsEmail },
  });

  return { email: user.email };
}
