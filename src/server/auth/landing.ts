import { isStaff, type Role } from "./session";

/**
 * Where a session lands once it is authenticated.
 *
 * Staff go to the back office and everyone else to their account: the first
 * screen after signing in should be the one the account exists for, not a
 * customer area an administrator has no file in and would have to leave by
 * typing a URL.
 *
 * For a customer an explicit `next` wins — somebody who followed a link to a
 * specific page and was asked to sign in on the way is returned to it. Only
 * relative in-app paths are honoured, so a crafted value cannot bounce a
 * freshly authenticated session to another site.
 *
 * Staff go to the back office whatever `next` says, unless it points inside
 * the back office itself: signing in as an administrator and landing on a
 * borrower page because of a link followed twenty minutes ago is never what
 * was meant.
 */
export function landingFor(locale: string, role: string, next: string | undefined): string {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (isStaff(role as Role)) {
    const backoffice = `/${locale}/backoffice`;
    return safeNext?.startsWith(backoffice) ? safeNext : backoffice;
  }
  return safeNext ?? `/${locale}/account`;
}
