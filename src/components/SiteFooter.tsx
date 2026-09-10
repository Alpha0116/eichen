import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { ContactButtons } from "./ContactButtons";
import { mailtoLink } from "@/server/config";

export function SiteFooter({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const t = dictionary.footer;

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] no-print">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-3">
            <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label={dictionary.common.brand}>
              <Image src="/eichen-mark.png" alt="" width={28} height={28} className="rounded-lg" />
              <span className="text-base font-semibold tracking-tight">{dictionary.common.brand}</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">{t.tagline}</p>
            {/* Reaching a person is a footer-level affordance, not something
                buried on the complaints page. */}
            <ContactButtons dictionary={dictionary} size="sm" />
          </div>

          <nav aria-label={t.columnCredit} className="space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.columnCredit}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href={`/${locale}/register`} className="hover:underline">
                  {dictionary.common.register}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}#creditTypes`} className="hover:underline">
                  {t.linkAutokredit}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}#creditTypes`} className="hover:underline">
                  {t.linkUmschuldung}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}#terms`} className="hover:underline">
                  {t.linkKonditionen}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t.columnCompany} className="space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.columnCompany}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href={`/${locale}#how`} className="hover:underline">
                  {t.linkHowItWorks}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}#faq`} className="hover:underline">
                  {t.linkFaq}
                </Link>
              </li>
              <li>
                <a href={mailtoLink(dictionary.contact.subject)} className="hover:underline">
                  {t.linkContact}
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label={t.columnLegal} className="space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t.columnLegal}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href={`/${locale}/legal`} className="hover:underline">
                  {dictionary.legal.imprint}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal#privacy`} className="hover:underline">
                  {dictionary.legal.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal#terms`} className="hover:underline">
                  {dictionary.legal.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal#complaints`} className="hover:underline">
                  {dictionary.legal.complaints}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-[var(--border)] pt-6">
          <p className="text-xs text-[var(--muted)]">{dictionary.legal.supervisory}</p>
        </div>
      </div>
    </footer>
  );
}
