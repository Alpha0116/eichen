import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon } from "./icons";
import type { Dictionary, Locale } from "@/i18n";

/**
 * The frame the sign-in and sign-up pages sit in.
 *
 * A full-height split: the form on the left, a photograph and the three
 * product claims on the right. Both halves are edge to edge, which is what
 * stops an authentication page reading as a small box floating in the middle
 * of an empty white page.
 *
 * The picture half is hidden below `lg` rather than stacked above the form —
 * on a phone, a decorative image the reader has to scroll past to reach the
 * password field is a cost with no benefit.
 */
export function AuthShell({
  locale,
  dictionary,
  title,
  children,
  footer,
}: {
  locale: Locale;
  dictionary: Dictionary;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const claims = [
    dictionary.landing.trustNeutral,
    dictionary.landing.trustNoAccount,
    dictionary.landing.trustCompare,
  ];

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center bg-[var(--surface-muted)] px-4 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2.5"
            aria-label={dictionary.common.brand}
          >
            <Image src="/eichen-mark.png" alt="" width={36} height={36} className="rounded-lg" />
            <span className="font-display text-xl font-semibold tracking-tight">
              {dictionary.common.brand}
            </span>
          </Link>

          <h1 className="sr-only">{title}</h1>
          {children}
          {footer}
        </div>
      </div>

      <div className="on-dark relative isolate hidden items-end overflow-hidden bg-[var(--primary)] lg:flex">
        <Image
          src="/auth-side.webp"
          alt=""
          fill
          priority
          sizes="50vw"
          className="-z-10 object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to top, rgb(13 0 93 / 0.95) 0%, rgb(13 0 93 / 0.7) 45%, rgb(13 0 93 / 0.35) 100%)",
          }}
        />
        <div className="space-y-6 p-12 xl:p-16">
          <p className="font-display text-[2rem] font-bold leading-tight tracking-tight text-white xl:text-[2.5rem]">
            {dictionary.landing.heroTitle}
          </p>
          <ul className="space-y-3">
            {claims.map((claim) => (
              <li key={claim} className="flex items-center gap-3 text-white/90">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {claim}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
