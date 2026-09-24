import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "./i18n/config";

/**
 * Locale routing.
 *
 * Every page lives under /{locale}, and German is the only language published,
 * so every request that does not already carry it is sent to /de. The segment
 * is kept rather than removed: adding a second language later is a dictionary
 * and an entry in LOCALES, not a change to every URL in the application.
 */
/** Languages this site once served, kept only so their URLs still resolve. */
const RETIRED_LOCALES = ["fr"] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();

  // Links to a language that used to be published are still out there, in
  // e-mails already sent and in bookmarks. They are moved to the same page in
  // German rather than prefixed into a path that does not exist.
  const retired = RETIRED_LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  url.pathname = retired
    ? `/${DEFAULT_LOCALE}${pathname.slice(retired.length + 1)}`
    : `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets, the framework's own routes, the two files crawlers ask
  // for by name and the web manifest keep their paths: a robots.txt that
  // answers with a redirect to a localised copy is a robots.txt no crawler
  // reads.
  matcher: [
    "/((?!_next|api|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)",
  ],
};
