import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { getSessionUser, isStaff, type SessionUser } from "./auth/session";
import { mfaRequiredFor } from "./auth/mfa";

export interface ApplicationAccess {
  user: SessionUser | null;
  applicationId: string;
  /** True when the viewer is staff rather than the borrower. */
  asStaff: boolean;
}

/**
 * Guards every application-scoped page and action.
 *
 * An unknown id is reported as not found rather than forbidden, so the guard
 * cannot be used to discover which references exist.
 */
export async function requireApplicationAccess(applicationId: string): Promise<ApplicationAccess> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true },
  });
  if (!application) notFound();

  const user = await getSessionUser();
  if (user && isStaff(user.role)) {
    return { user, applicationId, asStaff: true };
  }
  if (user && application.userId === user.id) {
    return { user, applicationId, asStaff: false };
  }

  // No anonymous path: an application belongs to the account that opened it,
  // and there is no cookie-held capability that could reach one without
  // signing in.
  notFound();
}

/**
 * An account whose password was set by somebody else gets no further than the
 * change form. Enforced here rather than only after signing in, so a session
 * that was already open when the flag was set is caught on its next page.
 */
function requireOwnPassword(locale: string, user: SessionUser): void {
  if (user.mustChangePassword) redirect(`/${locale}/password`);
}

export async function requireUser(locale: string, next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/${locale}/login${target}`);
  }
  requireOwnPassword(locale, user);
  return user;
}

/**
 * Staff-only guard. A signed-in customer who guesses a back-office URL gets a
 * 404 rather than a 403: confirming that the page exists tells them something
 * they have no business knowing.
 */
export async function requireStaff(locale: string, next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/${locale}/login${target}`);
  }
  if (!isStaff(user.role)) notFound();

  requireOwnPassword(locale, user);

  // Defence in depth, and only where a second factor is actually required:
  // with no obligation configured, a staff account signs in with a password
  // alone and must not be sent to an enrolment page it has no reason to
  // complete. Where an obligation *is* configured, a login cannot complete
  // without the factor, so this should be unreachable — but a session issued
  // before the role was raised would otherwise slip through.
  if (mfaRequiredFor(user.role) && !user.mfaEnabled) {
    redirect(`/${locale}/account/security/setup`);
  }

  return user;
}
