import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import type { SessionUser } from "@/server/auth/session";
import { isStaff } from "@/server/auth/session";
import { ButtonLink } from "./ui";
import { logoutAction } from "@/app/[locale]/(auth)/actions";

export function SiteHeader({
  locale,
  dictionary,
  user,
}: {
  locale: Locale;
  dictionary: Dictionary;
  user: SessionUser | null;
}) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] no-print">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label={dictionary.common.brand}>
          <Image src="/eichen-mark.png" alt="" width={32} height={32} className="rounded-lg" priority />
          <span className="text-lg font-semibold tracking-tight">{dictionary.common.brand}</span>
        </Link>

        <nav aria-label={dictionary.nav.howItWorks} className="flex items-center gap-4 text-sm">
          <Link href={`/${locale}#how`} className="hover:underline">
            {dictionary.nav.howItWorks}
          </Link>
          <Link href={`/${locale}#creditTypes`} className="hover:underline">
            {dictionary.nav.creditTypes}
          </Link>
          <Link href={`/${locale}#faq`} className="hover:underline">
            {dictionary.nav.faq}
          </Link>
          {user ? (
            <Link href={`/${locale}/account`} className="hover:underline">
              {dictionary.nav.account}
            </Link>
          ) : null}
          {user && isStaff(user.role) ? (
            <Link href={`/${locale}/backoffice`} className="hover:underline">
              {dictionary.common.backoffice}
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="hover:underline">
                {dictionary.common.logout}
              </button>
            </form>
          ) : (
            <Link href={`/${locale}/login`} className="hover:underline">
              {dictionary.common.login}
            </Link>
          )}
          {/* The single call to action follows the flow: an account first,
              then the account area once there is one. */}
          <ButtonLink href={user ? `/${locale}/account` : `/${locale}/register`} size="sm">
            {user ? dictionary.common.myAccount : dictionary.common.register}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
