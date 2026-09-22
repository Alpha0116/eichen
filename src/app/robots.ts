import type { MetadataRoute } from "next";
import { SITE_URL } from "@/i18n/seo";

/**
 * What a crawler may read.
 *
 * Everything a borrower reaches by signing in is disallowed. Those pages are
 * access-checked on the server, so this is not what protects them; it keeps a
 * crawler from spending its budget on redirects and from putting a URL that
 * belongs to one person's file into a public index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/*/apply/",
        "/*/account/",
        "/*/backoffice/",
        "/*/login",
        "/*/register",
        "/*/ads",
        "/*/mfa",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
