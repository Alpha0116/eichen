import type { Metadata } from "next";
import { COMPANY, CONTACT, PRODUCT } from "@/server/config";
import { DEFAULT_LOCALE, getDictionary, INTL_LOCALES, LOCALES, type Locale } from "./index";

/**
 * Search-engine metadata.
 *
 * Kept out of the dictionaries because these strings are not interface text:
 * nothing on a page renders them, they exist for crawlers and for the card a
 * link turns into when it is shared. Mixing them into the dictionaries would
 * have translators editing page titles by hand next to button labels.
 */

/**
 * The public origin, with no trailing slash.
 *
 * Every canonical, alternate and sitemap entry is built from it, so a
 * deployment on another domain needs one environment variable rather than a
 * search through the codebase.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://eichen-kredit.com").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "Eichen";

/** Where a page lives, per locale. Paths carry no locale prefix. */
export function urlFor(locale: Locale, path = ""): string {
  const suffix = path.replace(/^\/+/, "");
  return `${SITE_URL}/${locale}${suffix ? `/${suffix}` : ""}`;
}

/**
 * Alternates, when there is anything to alternate with.
 *
 * The site is published in German alone, and hreflang tags pointing a language
 * at itself say nothing. They come back the moment a second locale is added to
 * LOCALES, x-default resting on the default language.
 */
function alternates(path: string): { languages?: Record<string, string> } {
  if (LOCALES.length < 2) return {};
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[locale] = urlFor(locale, path);
  languages["x-default"] = urlFor(DEFAULT_LOCALE, path);
  return { languages };
}

/**
 * Titles and descriptions per page, per language.
 *
 * Written for a result listing rather than for the page: each one says what
 * the page is and what it offers, in the words somebody would search for,
 * without stacking keywords the sentence does not need.
 */
/**
 * The searches the home page answers. Search engines give the tag little
 * weight today; it stays because some still read it and it costs nothing.
 * Every term is something the product actually is.
 */
export const KEYWORDS = [
  "Kredit",
  "Onlinekredit",
  "Ratenkredit",
  "Privatkredit",
  "Kredit online beantragen",
  "günstiger Kredit",
  "Kredit 3 Prozent",
  "fester Sollzins",
  "Autokredit",
  "Umschuldung",
  "Kredit Potsdam",
  "Kredit Brandenburg",
  "Kreditrechner",
];

export const PAGE_SEO = {
  legal: {
    de: {
      title: "Impressum, Datenschutz und Beschwerden",
      description:
        "Rechtliche Angaben zu Eichen: Impressum, Datenschutz und Ihre Rechte, Vertragsbedingungen, Beschwerdewege und die zuständige Aufsichtsbehörde.",
    },
  },
} as const;

interface PageSeo {
  locale: Locale;
  /** Path without the locale prefix: "" for the home page, "legal" for legal. */
  path?: string;
  title: string;
  description: string;
}

/** Metadata for a page that should be found: canonical, alternates, cards. */
export function publicPageMetadata({ locale, path = "", title, description }: PageSeo): Metadata {
  return {
    title,
    description,
    alternates: { ...alternates(path), canonical: urlFor(locale, path) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: INTL_LOCALES[locale].replace("-", "_"),
      url: urlFor(locale, path),
      title,
      description,
      // The image itself is the file-based opengraph-image beside the
      // locale layout, drawn at the 1200×630 a preview card expects.
    },
    twitter: { card: "summary_large_image", title, description },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

/**
 * Metadata for everything behind a login.
 *
 * An application, an account and a back office have nothing to offer a search
 * engine and everything to lose by being crawled, so they say so in the page
 * as well as in robots.txt — a URL that leaks into a link is not covered by a
 * disallow rule the crawler read an hour earlier.
 */
export const privateMetadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  // The layout above sets a canonical for the public site; a page behind a
  // login must not inherit it and declare itself a copy of the home page.
  alternates: { canonical: null },
};

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const postalAddress = {
  "@type": "PostalAddress",
  streetAddress: COMPANY.street,
  postalCode: COMPANY.postalCode,
  addressLocality: COMPANY.city,
  addressRegion: COMPANY.region,
  addressCountry: COMPANY.country,
};

/**
 * Structured data for the home page.
 *
 * Only facts that are on the page or in configuration: the name, the postal
 * address printed in the imprint, a contact address, the rate and the amount
 * range, and the questions the FAQ answers. No ratings — review markup for
 * reviews a business publishes about itself is ignored by search engines at
 * best and penalised at worst.
 */
export function homeJsonLd(locale: Locale) {
  const dictionary = getDictionary(locale);
  const faq = dictionary.landing.faq.items;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "FinancialService"],
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/eichen-logo.png`,
        image: `${SITE_URL}/hero-city.webp`,
        description: dictionary.meta.description,
        email: CONTACT.email,
        address: postalAddress,
        geo: {
          "@type": "GeoCoordinates",
          latitude: COMPANY.geo.latitude,
          longitude: COMPANY.geo.longitude,
        },
        areaServed: { "@type": "Country", name: COMPANY.countryName },
        currenciesAccepted: PRODUCT.currency,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT.email,
          telephone: `+${CONTACT.whatsappNumber}`,
          availableLanguage: ["de"],
          areaServed: COMPANY.country,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: dictionary.meta.description,
        inLanguage: locale,
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "LoanOrCredit",
        name: dictionary.meta.title,
        description: dictionary.meta.description,
        url: urlFor(locale),
        provider: { "@id": ORGANIZATION_ID },
        areaServed: COMPANY.country,
        currency: PRODUCT.currency,
        loanType: "Ratenkredit",
        amount: {
          "@type": "MonetaryAmount",
          currency: PRODUCT.currency,
          minValue: PRODUCT.minAmount / 100,
          maxValue: PRODUCT.maxAmount / 100,
        },
        loanTerm: {
          "@type": "QuantitativeValue",
          minValue: PRODUCT.minTermMonths,
          maxValue: PRODUCT.maxTermMonths,
          unitCode: "MON",
        },
        interestRate: PRODUCT.referenceRate * 100,
      },
      {
        "@type": "FAQPage",
        "@id": `${urlFor(locale)}#faq`,
        inLanguage: locale,
        mainEntity: Object.values(faq).map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

/** Structured data for the imprint: where it sits, and whose it is. */
export function legalJsonLd(locale: Locale) {
  const dictionary = getDictionary(locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": urlFor(locale, "legal"),
        url: urlFor(locale, "legal"),
        name: PAGE_SEO.legal.de.title,
        inLanguage: locale,
        about: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: urlFor(locale) },
          {
            "@type": "ListItem",
            position: 2,
            name: dictionary.legal.imprint,
            item: urlFor(locale, "legal"),
          },
        ],
      },
    ],
  };
}
