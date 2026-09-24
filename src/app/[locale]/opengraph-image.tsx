import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getDictionary } from "@/i18n";
import { COMPANY } from "@/server/config";

/**
 * The card a link to the site turns into when it is shared, and the picture
 * a search engine may show next to a result. Drawn at the size every
 * platform asks for, from the same wording as the page title, so the preview
 * cannot promise something the page does not.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Eichen — Onlinekredit zu 3 % festem Sollzins";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);
  const mark = await readFile(path.join(process.cwd(), "public", "eichen-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #0d005d 0%, #1f1491 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={markSrc} width={88} height={88} style={{ borderRadius: 20 }} alt="" />
          <span style={{ fontSize: 56, fontWeight: 700 }}>{dictionary.common.brand}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            {dictionary.landing.heroTitle}
          </span>
          <span style={{ fontSize: 34, opacity: 0.85 }}>
            3 % gebundener Sollzins p. a. · Onlinekredit
          </span>
        </div>
        <span style={{ fontSize: 26, opacity: 0.7 }}>
          {COMPANY.street} · {COMPANY.postalCode} {COMPANY.city}
        </span>
      </div>
    ),
    size,
  );
}
