import type { Metadata } from "next";
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
      images: [{ url: "/eichen-logo.png", width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
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

/**
 * Structured data for the home page.
 *
 * Only facts that are on the page or in configuration: a name, a language, a
 * contact address and what the product is. No ratings, no invented postal
 * address — a knowledge panel built on figures nobody can check is worse than
 * none at all.
 */
export function homeJsonLd(locale: Locale, contactEmail: string) {
  const dictionary = getDictionary(locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/eichen-logo.png`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: contactEmail,
          availableLanguage: ["de"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "FinancialProduct",
        name: dictionary.meta.title,
        description: dictionary.meta.description,
        provider: { "@id": `${SITE_URL}/#organization` },
        areaServed: "DE",
        url: urlFor(locale),
      },
    ],
  };
}
