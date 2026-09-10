import { ButtonLink, Card } from "@/components/ui";
import { CoBorrowerIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";

/**
 * A teaser, not a working referral engine.
 *
 * No referral code is generated or displayed here: the product has no
 * tracking for one yet, and inventing a code that goes nowhere would be
 * exactly the kind of thing this codebase otherwise refuses to fake. The
 * copy is honest about that — it invites sign-up rather than claiming a
 * feature that does not exist.
 *
 * The right-hand panel is a plain icon motif rather than a photo: there is no
 * photography in this product, and a placeholder that reads "photo goes here"
 * would make the page look unfinished rather than simply illustrated.
 */
export function ReferralTeaser({ locale, dictionary }: { locale: string; dictionary: Dictionary }) {
  const t = dictionary.landing.referral;

  return (
    <section className="scroll-mt-20">
      <Card elevation="md" className="grid overflow-hidden sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-3 p-8 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
          <p className="text-[var(--muted)]">{t.body}</p>
          <ButtonLink href={`/${locale}/register`} className="mt-2">
            {t.cta}
          </ButtonLink>
        </div>
        <div className="hidden items-center justify-center bg-[var(--accent-soft)] p-10 sm:flex">
          <span className="flex h-28 w-28 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
            <CoBorrowerIcon className="h-14 w-14" />
          </span>
        </div>
      </Card>
    </section>
  );
}
