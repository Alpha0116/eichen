import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n";
import { urlFor } from "@/i18n/seo";

/**
 * The public map of the site.
 *
 * Only pages a stranger can open: the funnel, the account and the back office
 * are behind a login, and listing them would advertise URLs that answer with a
 * redirect at best. One entry per public page per published language — which
 * today means German alone.
 */
const PUBLIC_PATHS = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "legal", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_PATHS.flatMap(({ path, priority, changeFrequency }) =>
    LOCALES.map((locale) => ({
      url: urlFor(locale, path),
      lastModified,
      changeFrequency,
      priority,
      ...(LOCALES.length > 1
        ? {
            alternates: {
              languages: Object.fromEntries(
                LOCALES.map((alternate) => [alternate, urlFor(alternate, path)]),
              ),
            },
          }
        : {}),
    })),
  );
}
