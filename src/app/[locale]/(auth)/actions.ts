"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { mfaRequiredFor } from "@/server/auth/mfa";
import { createSession, destroyAllSessions, destroySession, getSessionUser } from "@/server/auth/session";
import { hashPassword, validatePassword, verifyPassword } from "@/server/auth/password";
import { landingFor } from "@/server/auth/landing";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

const LOCK_AFTER_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

const credentials = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
  locale: z.string().default(DEFAULT_LOCALE),
  next: z.string().optional(),
});

export type AuthFormState = { error?: string; minutes?: number };

function safeLocale(value: string): string {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Only relative in-app paths are accepted as a post-login destination, so a
 * crafted `next` cannot bounce a freshly authenticated user to another site.
 */
function safeNext(locale: string, next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return `/${locale}/account`;
  return next;
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidCredentials" };

  const { email, password, next } = parsed.data;
  const locale = safeLocale(parsed.data.locale);
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return {
      error: "accountLocked",
      minutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
    };
  }

  // The password is verified even when no such user exists, so the response
  // time does not reveal which addresses have accounts.
  const stored = user?.passwordHash ?? (await hashPassword("no-such-user-placeholder"));
  const valid = await verifyPassword(password, stored);

  if (!user || !valid) {
    if (user) {
      const failedLogins = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins,
          lockedUntil:
            failedLogins >= LOCK_AFTER_ATTEMPTS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : null,
        },
      });
    }
    return { error: "invalidCredentials" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const role = user.role as Parameters<typeof mfaRequiredFor>[0];
  const needsSecondFactor = user.mfaEnabled || mfaRequiredFor(role);

  if (needsSecondFactor) {
    // The password alone yields only a pending session, which authenticates
    // nobody. A staff account that has never enrolled is sent to enrolment
    // rather than let through — that is what makes MFA mandatory for the role
    // rather than merely offered.
    await createSession(user.id, { mfaPending: true });
    const target = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/${locale}/mfa${user.mfaEnabled ? "" : "/setup"}${target}`);
  }

  await createSession(user.id);
  // A password somebody else chose is changed before anything else happens.
  // The guards would send them here anyway; doing it at the door means the
  // first screen after signing in is the form rather than a redirect chain.
  if (user.mustChangePassword) redirect(`/${locale}/password`);
  // Anything this browser started anonymously now belongs to the account.
  // Staff land in the back office: a password-only sign-in is the path an
  // administrator takes when their role does not oblige a second factor, and
  // it should not leave them to reach their own tool by editing the URL.
  redirect(landingFor(locale, user.role, next));
}

const registration = credentials.extend({
  passwordRepeat: z.string(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
});

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registration.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };

  const { email, password, passwordRepeat, firstName, lastName, next } = parsed.data;
  const locale = safeLocale(parsed.data.locale);

  if (password !== passwordRepeat) return { error: "passwordMismatch" };
  const issue = validatePassword(password);
  if (issue) return { error: issue.code === "too_short" ? "passwordTooShort" : "passwordTooCommon" };

  const normalisedEmail = email.toLowerCase();
  if (await db.user.findUnique({ where: { email: normalisedEmail } })) {
    return { error: "emailTaken" };
  }

  const user = await db.user.create({
    data: {
      email: normalisedEmail,
      passwordHash: await hashPassword(password),
      locale,
      firstName: firstName || null,
      lastName: lastName || null,
    },
  });

  await createSession(user.id);
  redirect(safeNext(locale, next));
}

export async function resolvePostLogin(locale: string, next: string | undefined): Promise<string> {
  return safeNext(locale, next);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = safeLocale(String(formData.get("locale") ?? DEFAULT_LOCALE));
  await destroySession();
  redirect(`/${locale}`);
}

const passwordChange = z.object({
  currentPassword: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
  passwordRepeat: z.string().min(1).max(200),
  locale: z.string().default(DEFAULT_LOCALE),
});

/**
 * Replaces a password the account did not choose.
 *
 * The old one is still required. The account arrives here already signed in,
 * so without that check a session left open on a shared screen would be enough
 * to take the account over — the point of this screen is to end shared
 * knowledge of the password, not to hand it to whoever is sitting there.
 *
 * Every other session is dropped afterwards, including any the person who set
 * the initial password may still hold, and this one is reissued so the change
 * does not sign the account out of the browser doing the changing.
 */
export async function changePasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) redirect(`/${DEFAULT_LOCALE}/login`);

  const parsed = passwordChange.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };

  const locale = safeLocale(parsed.data.locale);
  const { currentPassword, password, passwordRepeat } = parsed.data;

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    return { error: "invalidCredentials" };
  }
  if (password !== passwordRepeat) return { error: "passwordMismatch" };
  if (password === currentPassword) return { error: "sameAsOld" };

  const issue = validatePassword(password);
  if (issue) {
    return { error: issue.code === "too_short" ? "passwordTooShort" : "passwordTooCommon" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });

  await destroyAllSessions(user.id);
  await createSession(user.id);

  redirect(landingFor(locale, row.role, undefined));
}
