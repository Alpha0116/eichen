import type { MetadataRoute } from "next";
import { getDictionary, DEFAULT_LOCALE } from "@/i18n";
import { SITE_NAME } from "@/i18n/seo";

/** Lets a phone put the site on its home screen under its own name and icon. */
export default function manifest(): MetadataRoute.Manifest {
  const dictionary = getDictionary(DEFAULT_LOCALE);
  return {
    name: dictionary.meta.title,
    short_name: SITE_NAME,
    description: dictionary.meta.description,
    start_url: `/${DEFAULT_LOCALE}`,
    lang: DEFAULT_LOCALE,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d005d",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
