import { Card } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { getDictionary, isLocale } from "@/i18n";
import { PAGE_SEO, legalJsonLd, publicPageMetadata } from "@/i18n/seo";
import { COMPANY, CONTACT } from "@/server/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const typedLocale = isLocale(locale) ? locale : "de";
  return publicPageMetadata({
    locale: typedLocale,
    path: "legal",
    ...PAGE_SEO.legal[typedLocale],
  });
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);
  const typedLocale = isLocale(locale) ? locale : "de";

  const sections = [
    {
      id: "privacy",
      title: dictionary.legal.privacy,
      paragraphs: [dictionary.legal.dataRights, dictionary.funnel.bank.storageNotice],
    },
    {
      id: "terms",
      title: dictionary.legal.terms,
      paragraphs: [dictionary.landing.transparencyBody],
    },
    {
      id: "complaints",
      title: dictionary.legal.complaints,
      paragraphs: [dictionary.legal.supervisory, dictionary.eligibility.humanReviewBody],
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        // Built from configuration and the dictionaries only.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(legalJsonLd(typedLocale)) }}
      />
      <PageHeader title={dictionary.legal.imprint} eyebrow={dictionary.common.brand} />

      <Section tone="surface" className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <Reveal>
            <Card as="section" className="space-y-3 p-6">
              <h2 id="imprint" className="scroll-mt-24 font-display text-lg font-semibold">
                {dictionary.legal.imprint}
              </h2>
              <p className="text-sm text-[var(--muted)]">{dictionary.legal.imprintIntro}</p>
              <address className="grid gap-4 text-sm not-italic leading-relaxed sm:grid-cols-2">
                <div>
                  <span className="block font-semibold">{dictionary.legal.addressLabel}</span>
                  <span className="block">{COMPANY.name}</span>
                  <span className="block">{COMPANY.street}</span>
                  <span className="block">
                    {COMPANY.postalCode} {COMPANY.city}
                  </span>
                  <span className="block">{COMPANY.countryName}</span>
                </div>
                <div>
                  <span className="block font-semibold">{dictionary.legal.contactLabel}</span>
                  <a href={`mailto:${CONTACT.email}`} className="block hover:underline">
                    {CONTACT.email}
                  </a>
                </div>
              </address>
            </Card>
          </Reveal>

          {sections.map((section, index) => (
            <Reveal key={section.id} delay={index * 70}>
              <Card as="section" className="space-y-3 p-6">
                {/* The id sits on the heading, not the card, so the anchors the
                    footer links to land on the title rather than above it. */}
                <h2 id={section.id} className="scroll-mt-24 font-display text-lg font-semibold">
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-[var(--muted)]">
                    {paragraph}
                  </p>
                ))}
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="muted" className="py-12 sm:py-16">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <h2 className="font-display text-[length:var(--text-h3)] font-semibold">
              {dictionary.contact.title}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{dictionary.contact.body}</p>
          </div>
          <ContactButtons dictionary={dictionary} />
        </Reveal>
      </Section>
    </div>
  );
}
