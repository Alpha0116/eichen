"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { landingFor } from "@/server/auth/landing";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { completeMfaChallenge, getPendingMfaUser, getSessionUser } from "@/server/auth/session";
import { beginEnrolment, confirmEnrolment, disableMfa, verifyChallenge } from "@/server/auth/mfa";

export type MfaState = {
  error?: "invalidCode" | "locked" | "expired" | "notEnrolled" | "validation";
  minutes?: number;
  recoveryCodes?: string[];
  recoveryUsed?: boolean;
  remaining?: number;
};

function safeLocale(value: string): string {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

const codeSchema = z.object({
  code: z.string().trim().min(4).max(20),
  locale: z.string().default(DEFAULT_LOCALE),
  next: z.string().optional(),
});

/** The second step of a login: promotes the pending session, or refuses it. */
export async function verifyMfaAction(_previous: MfaState, formData: FormData): Promise<MfaState> {
  const parsed = codeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };

  const locale = safeLocale(parsed.data.locale);
  const pending = await getPendingMfaUser();
  if (!pending) return { error: "expired" };

  const result = await verifyChallenge(pending.id, parsed.data.code);
  if (!result.ok) {
    if (result.reason === "LOCKED") return { error: "locked", minutes: result.minutes };
    if (result.reason === "NOT_ENROLLED") return { error: "notEnrolled" };
    return { error: "invalidCode" };
  }

  if (!(await completeMfaChallenge())) return { error: "expired" };
  redirect(landingFor(locale, pending.role, parsed.data.next));
}

/**
 * Confirms enrolment and hands back the recovery codes.
 *
 * The session stays pending here on purpose: access is granted only after the
 * next step, where the user confirms they have saved the codes. Enrolling
 * someone and dropping them straight into the back office is how recovery
 * codes end up unread.
 */
export async function confirmEnrolmentAction(
  _previous: MfaState,
  formData: FormData,
): Promise<MfaState> {
  const parsed = codeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };

  // Enrolment is reachable both from a pending login and from a signed-in
  // customer adding a second factor voluntarily.
  const pending = await getPendingMfaUser();
  const active = pending ? null : await getSessionUser();
  const userId = pending?.id ?? active?.id;
  if (!userId) return { error: "expired" };

  const result = await confirmEnrolment(userId, parsed.data.code);
  if (!result.ok) {
    return { error: result.reason === "NO_PENDING_SECRET" ? "expired" : "invalidCode" };
  }

  return { recoveryCodes: result.recoveryCodes };
}

/** Acknowledges the recovery codes and finishes the login. */
export async function finishEnrolmentAction(localeParam: string, next: string | undefined): Promise<void> {
  const locale = safeLocale(localeParam);
  const pending = await getPendingMfaUser();

  if (pending) {
    if (!(await completeMfaChallenge())) redirect(`/${locale}/login`);
    redirect(landingFor(locale, pending.role, next));
  }

  const active = await getSessionUser();
  redirect(active ? `/${locale}/account/security` : `/${locale}/login`);
}

/** Restarts enrolment, producing a fresh candidate secret. */
export async function restartEnrolmentAction(localeParam: string): Promise<void> {
  const locale = safeLocale(localeParam);
  const pending = await getPendingMfaUser();
  const active = pending ? null : await getSessionUser();
  const userId = pending?.id ?? active?.id;
  if (!userId) redirect(`/${locale}/login`);

  await beginEnrolment(userId);
  redirect(pending ? `/${locale}/mfa/setup` : `/${locale}/account/security/setup`);
}

export async function disableMfaAction(localeParam: string): Promise<void> {
  const locale = safeLocale(localeParam);
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  await disableMfa(user.id);
  redirect(`/${locale}/account/security`);
}
