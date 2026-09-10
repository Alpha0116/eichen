import { isStaff, type Role } from "./session";

/**
 * Where a session lands once it is authenticated.
 *
 * Staff go to the back office and everyone else to their account: the first
 * screen after signing in should be the one the account exists for, not a
 * customer area an administrator has no file in and would have to leave by
 * typing a URL.
 *
 * An explicit `next` still wins — somebody who followed a link to a specific
 * page and was asked to sign in on the way is returned to it. Only relative
 * in-app paths are honoured, so a crafted value cannot bounce a freshly
 * authenticated session to another site.
 */
export function landingFor(locale: string, role: string, next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return isStaff(role as Role) ? `/${locale}/backoffice` : `/${locale}/account`;
}
