import Image from "next/image";
import { Alert, ButtonLink, Card, Figure } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { CompareIcon, InstantIcon, NoAccountIcon, ShieldCheckIcon } from "@/components/icons";
import { Benefits } from "@/components/landing/Benefits";
import { CreditTypes } from "@/components/landing/CreditTypes";
import { DataTrust } from "@/components/landing/DataTrust";
import { Faq } from "@/components/landing/Faq";
import { RateDisclosure } from "@/components/landing/RateDisclosure";
import { Reviews } from "@/components/landing/Reviews";
import { TermsOverview } from "@/components/landing/TermsOverview";
import { ThreeSteps } from "@/components/landing/ThreeSteps";
import { priceLoan } from "@/domain/finance/quote";
import { getDictionary, type Locale } from "@/i18n";
import { formatMoney, formatPercent } from "@/i18n/format";
import { CONTACT, PRODUCT } from "@/server/config";
import { homeJsonLd } from "@/i18n/seo";
import { getSessionUser } from "@/server/auth/session";

const TRUST_ICONS = [ShieldCheckIcon, NoAccountIcon, CompareIcon] as const;

/**
 * The home page.
 *
 * It explains the product and sends the visitor to register; it does not start
 * an application. The simulator lives inside the funnel, behind the account,
 * because the flow puts registration first.
 *
 * Structurally it is a stack of full-bleed bands whose grounds alternate —
 * photograph, white, tinted, navy, white — so a long page reads as a sequence
 * of distinct sections rather than one continuous white sheet. Content inside
 * each band still sits on the 1200px grid from the design system; it is the
 * grounds that go edge to edge, not the paragraphs.
 *
 * The headline figures are computed by `priceLoan`, the same module the
 * contract is priced with, so the example here cannot drift from the product.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const user = await getSessionUser();

  const trustItems = [
    dictionary.landing.trustNeutral,
    dictionary.landing.trustNoAccount,
    dictionary.landing.trustCompare,
  ];

  const example = priceLoan({
    netAmount: PRODUCT.defaultAmount,
    termMonths: PRODUCT.defaultTermMonths,
    nominalAnnualRate: PRODUCT.referenceRate,
    currency: "EUR",
    drawdownDate: new Date(),
  });

  // Signed in, the primary action is their own account; signed out, it is
  // creating one. Offering "create an account" to someone who has one is the
  // fastest way to make a site feel like it has forgotten them.
  const primaryHref = user ? `/${locale}/account` : `/${locale}/register`;
  const primaryLabel = user ? dictionary.common.myAccount : dictionary.landing.ctaPrimary;

  return (
    <div>
      {/* Structured data, for the panel a search engine builds out of a site.
          Only what the page already says: no rating, no invented address. */}
      <script
        type="application/ld+json"
        // The payload is built from configuration and the dictionaries, not
        // from anything a visitor can supply.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd(typedLocale, CONTACT.email)) }}
      />

      {/* --- Hero: a full-viewport photograph, slowly drifting ------------- */}
      <section className="relative isolate flex min-h-[min(88vh,46rem)] items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src="/hero-city.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="ds-hero-image object-cover object-center"
          />
        </div>
        {/* Two scrims rather than one. A single diagonal gradient left the
            copy sitting over the brightest part of the photograph, where white
            text on a sunlit façade falls well under 4.5:1. The horizontal
            layer darkens the column the text occupies; the vertical one
            catches the trust chips at the bottom, which the first layer has
            already faded out by. */}
        {/* Explicit stops rather than the default even thirds: the copy column
            ends around 55% of the width, so the scrim has to stay near full
            strength until there and only then fall away. A default
            `via-` gradient puts its midpoint at 50%, which is exactly where
            the last line of the paragraph sits. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, rgb(13 0 93 / 0.94) 0%, rgb(13 0 93 / 0.88) 38%, rgb(13 0 93 / 0.55) 62%, rgb(13 0 93 / 0.08) 100%)",
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0d005d]/50 via-transparent to-[#0d005d]/25" />

        {/* Deliberately not wrapped in Reveal: this is the largest contentful
            paint. Fading it in would leave the headline blank for most of a
            second on every load, to animate something the reader is already
            looking at. The photograph's slow pan carries the motion here. */}
        <div className="ds-container relative py-20 sm:py-28">
          <div className="max-w-2xl space-y-6">
            <span className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              {dictionary.landing.kicker}
            </span>
            <h1 className="font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white [text-shadow:0_2px_24px_rgb(13_0_93_/_0.45)] sm:text-[3.5rem] lg:text-[4.25rem]">
              {dictionary.landing.heroTitle}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-white [text-shadow:0_1px_10px_rgb(13_0_93_/_0.55)] sm:text-[length:var(--text-body-lg)]">
              {dictionary.landing.heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <ButtonLink href={primaryHref} className="shadow-[var(--shadow-lg)]">
                {primaryLabel}
              </ButtonLink>
              {user ? null : (
                <ButtonLink
                  href={`/${locale}/login`}
                  variant="secondary"
                  className="border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
                >
                  {dictionary.landing.ctaLogin}
                </ButtonLink>
              )}
            </div>

            <ul className="flex flex-col gap-2.5 pt-4 sm:flex-row sm:flex-wrap">
              {trustItems.map((item, index) => {
                const Icon = TRUST_ICONS[index];
                return (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 rounded-full border border-white/30 bg-[#0d005d]/45 py-1.5 pl-2 pr-4 text-sm font-medium text-white backdrop-blur-md"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* --- The offer, and the reason the account comes first ------------- */}
      <Section id="how" tone="surface">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal className="space-y-7">
            <div className="flex items-center gap-3">
              <Image
                src="/eichen-mark.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl shadow-[var(--shadow-sm)]"
              />
              <span className="font-display text-2xl font-semibold tracking-tight">
                {dictionary.common.brand}
              </span>
            </div>

            <h2 className="font-display text-[1.75rem] font-bold tracking-tight sm:text-[length:var(--text-h1)]">
              {dictionary.landing.accountFirstTitle}
            </h2>
            <p className="max-w-xl text-[length:var(--text-body-lg)] leading-relaxed text-[var(--muted)]">
              {dictionary.landing.accountFirstBody}
            </p>

            <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-[var(--border)] pt-6 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                  <CompareIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">
                    {dictionary.landing.socialProof.lendersCount}
                  </span>
                  <span className="block text-[var(--muted)]">
                    {dictionary.landing.socialProof.lendersSub}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                  <InstantIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">
                    {dictionary.landing.socialProof.instant}
                  </span>
                  <span className="block text-[var(--muted)]">
                    {dictionary.landing.socialProof.instantSub}
                  </span>
                </span>
              </div>
            </div>

            <ContactButtons dictionary={dictionary} />
          </Reveal>

          <Reveal variant="scale" delay={120}>
            <Card
              elevation="lg"
              className="space-y-6 bg-gradient-to-br from-[var(--primary-light)] to-[var(--accent-soft)] p-7 sm:p-9"
            >
              <dl className="grid gap-4 rounded-[var(--radius-md)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] sm:grid-cols-2">
                <Figure
                  label={dictionary.simulator.nominalRate}
                  value={formatPercent(example.nominalAnnualRate, typedLocale)}
                  emphasis
                  accent="rate"
                />
                <Figure
                  label={dictionary.simulator.instalment}
                  value={formatMoney(example.base.instalment, typedLocale)}
                  emphasis
                  hint={formatMoney(PRODUCT.defaultAmount, typedLocale, "EUR", {
                    showDecimals: false,
                  })}
                />
                <Figure
                  label={dictionary.simulator.effectiveRate}
                  value={formatPercent(example.effectiveAnnualRate, typedLocale)}
                />
                <Figure
                  label={dictionary.simulator.totalPayable}
                  value={formatMoney(example.base.totalPayable, typedLocale)}
                />
              </dl>

              <ButtonLink href={primaryHref} className="w-full">
                {primaryLabel}
              </ButtonLink>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* --- The five steps, on a tinted ground ---------------------------- */}
      <Section tone="muted">
        <ThreeSteps dictionary={dictionary} />
      </Section>

      {/* --- Full-bleed image split: what we do not promise ---------------- */}
      <section className="grid items-stretch lg:grid-cols-2">
        <div className="relative min-h-[18rem] lg:min-h-[30rem]">
          <Image
            src="/band-desk.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="on-dark flex items-center bg-[var(--primary)] px-6 py-16 sm:px-12 lg:py-24">
          <Reveal className="max-w-xl space-y-5">
            <h2 className="font-display text-[1.75rem] font-bold tracking-tight sm:text-[length:var(--text-h2)]">
              {dictionary.landing.transparencyTitle}
            </h2>
            <p className="leading-relaxed text-[var(--muted)]">
              {dictionary.landing.transparencyBody}
            </p>
            <ButtonLink href={`/${locale}/legal`} variant="secondary">
              {dictionary.legal.terms}
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      {/* --- Conditions table --------------------------------------------- */}
      <Section id="terms" tone="surface">
        <Reveal>
          <TermsOverview locale={typedLocale} dictionary={dictionary} />
        </Reveal>
      </Section>

      {/* --- Reviews, edge to edge ----------------------------------------- */}
      <Section tone="muted" bleed className="py-16 sm:py-24">
        <Reviews dictionary={dictionary} />
      </Section>

      {/* --- Credit types, with photographs -------------------------------- */}
      <Section id="creditTypes" tone="surface">
        <CreditTypes locale={typedLocale} dictionary={dictionary} />
      </Section>

      {/* --- Benefits, on the navy ground ---------------------------------- */}
      <Section tone="primary">
        <Benefits dictionary={dictionary} />
      </Section>

      {/* --- Why we ask for this data -------------------------------------- */}
      <Section tone="surface">
        <DataTrust dictionary={dictionary} />
      </Section>

      {/* --- FAQ on the warm ground ---------------------------------------- */}
      <Section id="faq" tone="accent">
        <Faq dictionary={dictionary} />
      </Section>

      {/* --- Closing call to action over a photograph ---------------------- */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/band-family.webp"
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[#0d005d]/72" />
        <div className="ds-container py-20 text-center sm:py-28">
          <Reveal className="mx-auto max-w-2xl space-y-6">
            <h2 className="font-display text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-[length:var(--text-h1)]">
              {dictionary.landing.closingTitle}
            </h2>
            <p className="text-lg leading-relaxed text-white/85">
              {dictionary.landing.closingBody}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <ButtonLink href={primaryHref} className="shadow-[var(--shadow-lg)]">
                {primaryLabel}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- Statutory disclosure ------------------------------------------ */}
      <Section tone="surface" className="py-12 sm:py-16">
        <Alert variant="outline" title={dictionary.landing.rateDisclosureTitle}>
          <RateDisclosure locale={typedLocale} />
        </Alert>
      </Section>
    </div>
  );
}
