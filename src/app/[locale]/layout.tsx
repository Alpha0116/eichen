import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, getDictionary, isLocale, type Locale } from "@/i18n";
import { KEYWORDS, SITE_NAME, SITE_URL, publicPageMetadata } from "@/i18n/seo";
import { COMPANY } from "@/server/config";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSessionUser } from "@/server/auth/session";

/**
 * ressources/design-system.md § 2: Sora for headings, Inter for running text.
 *
 * Self-hosted rather than fetched from Google. Three reasons, in order of
 * weight: a build that reaches the network can fail for reasons that have
 * nothing to do with the code — and did; a visitor's browser never announces
 * itself to a third party, which for a German consumer product is not a
 * detail (LG München I, 3 O 17493/20); and the files are served from the same
 * origin as everything else, so there is no second connection to open.
 *
 * Both are variable fonts covering 400–700, which is the whole range the
 * design system's type scale asks for.
 */
const sora = localFont({
  src: "../fonts/sora-variable.woff2",
  variable: "--font-sora",
  weight: "400 700",
  display: "swap",
});

const inter = localFont({
  src: "../fonts/inter-variable.woff2",
  variable: "--font-inter",
  weight: "400 700",
  display: "swap",
});

/**
 * Every page under this segment renders behind a session read. Prerendering
 * one would risk serving a cached shell that shows the wrong person's state,
 * so the whole segment is rendered per request.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * The defaults every page under this segment inherits.
 *
 * `metadataBase` is what turns the relative image paths below into the
 * absolute URLs a crawler and a link preview both need. The title template
 * lets each page name itself without repeating the brand.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = getDictionary(locale);
  const typedLocale = isLocale(locale) ? locale : "de";

  return {
    // Spread first: its plain `title` would otherwise replace the template.
    ...publicPageMetadata({
      locale: typedLocale,
      title: dictionary.meta.title,
      description: dictionary.meta.description,
    }),
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: { default: dictionary.meta.title, template: `%s — ${SITE_NAME}` },
    description: dictionary.meta.description,
    keywords: KEYWORDS,
    category: "finance",
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    // Figures such as "14473" or a rate must not turn into tap-to-call links.
    formatDetection: { telephone: false, address: false, email: false },
    // Set in the deployment once the property is claimed in Search Console
    // and Bing Webmaster Tools; absent, no tag is emitted.
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : undefined,
    },
    other: {
      "geo.region": `${COMPANY.country}-BB`,
      "geo.placename": COMPANY.city,
      "geo.position": `${COMPANY.geo.latitude};${COMPANY.geo.longitude}`,
      ICBM: `${COMPANY.geo.latitude}, ${COMPANY.geo.longitude}`,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const user = await getSessionUser();

  return (
    // The inline script below stamps `data-js` on this element before React
    // hydrates, so the server markup and the client tree differ on <html> by
    // design. Suppressing the warning here is narrower than moving the flag
    // onto a wrapper element, which would put the reveal styles behind an
    // extra div.
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} antialiased min-h-screen flex flex-col`}>
        {/* Marks the document as scripted before first paint, which is what
            lets the scroll-reveal CSS hide elements it is able to reveal
            again. Without scripting the attribute never appears and every
            section renders visible. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute('data-js','')`,
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:shadow"
        >
          {dictionary.common.skipToContent}
        </a>
        <SiteHeader locale={locale as Locale} dictionary={dictionary} user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale as Locale} dictionary={dictionary} />
      </body>
    </html>
  );
}
