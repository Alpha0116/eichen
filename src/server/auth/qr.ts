import QRCode from "qrcode";

/**
 * Renders an otpauth URI as an inline SVG.
 *
 * Server-side so the page needs no client-side QR library, and so the secret
 * is never handed to a third-party rendering service — which is what most
 * "just use an image URL" QR approaches quietly do.
 */
export async function otpauthQrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    width: 200,
    color: { dark: "#0d005d", light: "#ffffff" },
  });
}
