import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { Locale } from "../../i18n";
import { formatDate, formatDateTime } from "../../i18n/format";
import {
  TEXT,
  costRows,
  defaultInterestParagraph,
  insuranceParagraph,
  partyRows,
  repaymentRows,
  scheduleRows,
  type ContractData,
  type Row,
} from "./contractDocument";
import { CONTRACT_LOGO_PNG, CONTRACT_LOGO_RATIO } from "./contractLogo";

/**
 * Typesetting for the credit agreement and the information sheet.
 *
 * A credit agreement is handed over, printed, filed and produced years later
 * in front of somebody who was not there. That is a PDF, not a web page: it
 * paginates the same way on every machine, it cannot reflow into something
 * else, and the signature can sit inside the document rather than beside it.
 *
 * The layout is done here rather than by driving a headless browser. A PDF
 * writer has no runtime to install, no sandbox to keep alive and no chance of
 * rendering differently on a server that happens to have a different Chrome.
 */

const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = { top: 82, bottom: 62, left: 56, right: 56 } as const;
/** The logo at the head of every page, above the top margin. */
const LETTERHEAD = { height: 26, top: 30 } as const;
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

const INK = rgb(0.071, 0.063, 0.227);
const MUTED = rgb(0.29, 0.278, 0.439);
const RULE = rgb(0.89, 0.882, 0.941);
const ACCENT = rgb(0.051, 0, 0.365);

const SIZE = { title: 19, h2: 11.5, body: 9.6, small: 8.2, micro: 7 } as const;
const LEADING = 1.45;

/** Labels for the signature page. They exist nowhere else, so they live here. */
const SIGNATURE_TEXT = {
  de: {
    title: "Unterschrift",
    intro:
      "Mit der nachstehenden Unterschrift nimmt die darlehensnehmende Person den vorstehenden Vertrag an.",
    signer: "Darlehensnehmerin oder Darlehensnehmer",
    signedAt: "Unterzeichnet am",
    drawn: "Handschriftliche Unterschrift",
    evidenceTitle: "Nachweis",
    evidenceNote:
      "Einfache elektronische Signatur nach Artikel 3 Nummer 10 eIDAS. Die folgenden Prüfsummen binden die Unterschrift an genau diesen Vertragstext: eine nachträgliche Änderung ergäbe andere Werte.",
    documentHash: "Dokument (SHA-256)",
    signatureHash: "Unterschrift (SHA-256)",
    evidenceHash: "Nachweis (SHA-256)",
  },
} as const;

/**
 * The characters above Latin-1 that the standard fonts can still print.
 *
 * The standard PDF fonts are encoded in WinAnsi, and pdf-lib refuses anything
 * outside it rather than printing a wrong glyph. French currency formatting
 * emits a narrow no-break space that is not in it, so the text is normalised
 * before it reaches the page instead of failing at render time on a figure.
 */
const WIN_ANSI_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

function sanitise(value: string): string {
  let out = "";
  for (const character of value.normalize("NFC")) {
    const code = character.codePointAt(0)!;
    // Every flavour of thin, narrow and non-breaking space becomes a plain
    // one: they are spacing, and a figure must never be dropped for one.
    if (code === 0x00a0 || code === 0x2007 || code === 0x2009 || code === 0x202f) out += " ";
    else if (code === 0x2212) out += "-";
    else if (code < 0x0100 && code !== 0x00ad) out += character;
    else if (WIN_ANSI_EXTRAS.has(character)) out += character;
  }
  return out;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** What a page needs embedded in the document before anything is drawn. */
interface Assets extends Fonts {
  logo: PDFImage;
}

/**
 * A cursor that walks down the page and starts a new one when it runs out.
 *
 * Everything here writes through it, so no drawing routine has to know which
 * page it is on or whether the block it is about to write still fits.
 */
class Writer {
  private page: PDFPage;
  private y: number;
  private pageNumber: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Assets,
    private readonly footerNote: string,
  ) {
    // Continues the numbering of whatever the document already holds, so the
    // signature appended to a four-page contract is page five and not page one.
    this.pageNumber = doc.getPageCount();
    this.page = this.begin();
    this.y = PAGE.height - MARGIN.top;
  }

  private begin(): PDFPage {
    const page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pageNumber += 1;
    // The logo heads every page, not only the first: a page of the schedule
    // printed on its own still says whose contract it belongs to.
    const logoWidth = LETTERHEAD.height * CONTRACT_LOGO_RATIO;
    page.drawImage(this.fonts.logo, {
      x: MARGIN.left,
      y: PAGE.height - LETTERHEAD.top - LETTERHEAD.height,
      width: logoWidth,
      height: LETTERHEAD.height,
    });
    page.drawLine({
      start: { x: MARGIN.left, y: MARGIN.bottom - 14 },
      end: { x: PAGE.width - MARGIN.right, y: MARGIN.bottom - 14 },
      thickness: 0.5,
      color: RULE,
    });
    page.drawText(sanitise(this.footerNote), {
      x: MARGIN.left,
      y: MARGIN.bottom - 26,
      size: SIZE.micro,
      font: this.fonts.regular,
      color: MUTED,
    });
    const number = String(this.pageNumber);
    page.drawText(number, {
      x: PAGE.width - MARGIN.right - this.fonts.regular.widthOfTextAtSize(number, SIZE.micro),
      y: MARGIN.bottom - 26,
      size: SIZE.micro,
      font: this.fonts.regular,
      color: MUTED,
    });
    return page;
  }

  /** Starts a new page when `height` would run past the bottom margin. */
  private ensure(height: number) {
    if (this.y - height < MARGIN.bottom) {
      this.page = this.begin();
      this.y = PAGE.height - MARGIN.top;
    }
  }

  space(amount: number) {
    this.y -= amount;
  }

  private wrap(value: string, font: PDFFont, size: number, width: number): string[] {
    const words = sanitise(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  paragraph(
    value: string,
    options: { size?: number; color?: typeof INK; bold?: boolean; width?: number } = {},
  ) {
    const size = options.size ?? SIZE.body;
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const width = options.width ?? CONTENT_WIDTH;
    const step = size * LEADING;
    for (const line of this.wrap(value, font, size, width)) {
      this.ensure(step);
      this.y -= step;
      this.page.drawText(line, {
        x: MARGIN.left,
        y: this.y,
        size,
        font,
        color: options.color ?? INK,
      });
    }
  }

  title(value: string) {
    this.ensure(SIZE.title * 2);
    this.y -= SIZE.title * 1.2;
    this.page.drawText(sanitise(value), {
      x: MARGIN.left,
      y: this.y,
      size: SIZE.title,
      font: this.fonts.bold,
      color: INK,
    });
    this.y -= 10;
    this.page.drawLine({
      start: { x: MARGIN.left, y: this.y },
      end: { x: PAGE.width - MARGIN.right, y: this.y },
      thickness: 1.4,
      color: ACCENT,
    });
    this.y -= 6;
  }

  heading(value: string) {
    // Kept with the first line of what follows: a heading alone at the foot of
    // a page reads as a section that says nothing.
    this.ensure(SIZE.h2 * 3.4);
    this.y -= SIZE.h2 * 1.9;
    this.page.drawText(sanitise(value), {
      x: MARGIN.left,
      y: this.y,
      size: SIZE.h2,
      font: this.fonts.bold,
      color: INK,
    });
    this.y -= 4;
  }

  /** Label on the left, value on the right, one ruled line per row. */
  rows(rows: readonly Row[]) {
    const labelWidth = CONTENT_WIDTH * 0.5;
    const valueX = MARGIN.left + labelWidth + 12;
    const valueWidth = CONTENT_WIDTH - labelWidth - 12;
    const step = SIZE.body * LEADING;

    for (const [label, value] of rows) {
      const labelLines = this.wrap(label, this.fonts.regular, SIZE.body, labelWidth);
      const valueLines = this.wrap(value, this.fonts.bold, SIZE.body, valueWidth);
      const height = Math.max(labelLines.length, valueLines.length) * step + 7;
      this.ensure(height);
      const top = this.y;

      labelLines.forEach((line, index) => {
        this.page.drawText(line, {
          x: MARGIN.left,
          y: top - step * (index + 1) + 3,
          size: SIZE.body,
          font: this.fonts.regular,
          color: MUTED,
        });
      });
      valueLines.forEach((line, index) => {
        this.page.drawText(line, {
          x: valueX,
          y: top - step * (index + 1) + 3,
          size: SIZE.body,
          font: this.fonts.bold,
          color: INK,
        });
      });

      this.y = top - height;
      this.page.drawLine({
        start: { x: MARGIN.left, y: this.y + 4 },
        end: { x: PAGE.width - MARGIN.right, y: this.y + 4 },
        thickness: 0.5,
        color: RULE,
      });
    }
    this.y -= 4;
  }

  /**
   * A columnar table with a repeated header.
   *
   * The amortisation plan runs to a hundred-odd rows, so the header is drawn
   * again on every page it spills onto: a column of figures with no heading on
   * page four is not a table anybody can read.
   */
  table(headers: readonly string[], body: readonly string[][], widths: readonly number[]) {
    const step = SIZE.small * 1.6;
    const columns = widths.map((share) => share * CONTENT_WIDTH);

    const drawHeader = () => {
      this.ensure(step * 2);
      this.y -= step;
      let x = MARGIN.left;
      headers.forEach((header, index) => {
        const text = sanitise(header);
        const width = columns[index]!;
        const offset =
          index === 0 ? 0 : width - this.fonts.bold.widthOfTextAtSize(text, SIZE.small);
        this.page.drawText(text, {
          x: x + offset,
          y: this.y,
          size: SIZE.small,
          font: this.fonts.bold,
          color: MUTED,
        });
        x += width;
      });
      this.y -= 5;
      this.page.drawLine({
        start: { x: MARGIN.left, y: this.y },
        end: { x: PAGE.width - MARGIN.right, y: this.y },
        thickness: 0.8,
        color: RULE,
      });
    };

    drawHeader();
    for (const row of body) {
      if (this.y - step < MARGIN.bottom) {
        this.page = this.begin();
        this.y = PAGE.height - MARGIN.top;
        drawHeader();
      }
      this.y -= step;
      let x = MARGIN.left;
      row.forEach((cell, index) => {
        const text = sanitise(cell);
        const width = columns[index]!;
        // The first column is a counter and reads best flush left; every other
        // one is money or a date, and those line up on the right.
        const offset =
          index === 0 ? 0 : width - this.fonts.regular.widthOfTextAtSize(text, SIZE.small);
        this.page.drawText(text, {
          x: x + offset,
          y: this.y,
          size: SIZE.small,
          font: this.fonts.regular,
          color: INK,
        });
        x += width;
      });
    }
    this.y -= 6;
  }

  /** The signature itself: the drawing, who made it, and when. */
  signature(image: PDFImage | null, labels: { drawn: string; name: string; when: string }) {
    const boxHeight = 96;
    this.ensure(boxHeight + 34);
    this.y -= 10;
    const top = this.y;

    this.page.drawRectangle({
      x: MARGIN.left,
      y: top - boxHeight,
      width: CONTENT_WIDTH,
      height: boxHeight,
      borderColor: RULE,
      borderWidth: 1,
    });

    if (image) {
      const scaled = image.scaleToFit(CONTENT_WIDTH - 48, boxHeight - 40);
      this.page.drawImage(image, {
        x: MARGIN.left + 24,
        y: top - boxHeight + 30,
        width: scaled.width,
        height: scaled.height,
      });
    }

    this.page.drawLine({
      start: { x: MARGIN.left + 24, y: top - boxHeight + 26 },
      end: { x: PAGE.width - MARGIN.right - 24, y: top - boxHeight + 26 },
      thickness: 0.6,
      color: RULE,
    });
    this.page.drawText(sanitise(labels.name), {
      x: MARGIN.left + 24,
      y: top - boxHeight + 13,
      size: SIZE.small,
      font: this.fonts.bold,
      color: INK,
    });
    const when = sanitise(labels.when);
    this.page.drawText(when, {
      x: PAGE.width - MARGIN.right - 24 - this.fonts.regular.widthOfTextAtSize(when, SIZE.micro),
      y: top - boxHeight + 13,
      size: SIZE.micro,
      font: this.fonts.regular,
      color: MUTED,
    });

    this.y = top - boxHeight - 8;
    this.paragraph(labels.drawn, { size: SIZE.micro, color: MUTED });
  }
}

async function assetsOf(doc: PDFDocument): Promise<Assets> {
  const [regular, bold, logo] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedPng(CONTRACT_LOGO_PNG),
  ]);
  return { regular, bold, logo };
}

function describe(doc: PDFDocument, data: ContractData, title: string) {
  doc.setTitle(sanitise(`${title} ${data.reference}`));
  doc.setSubject(sanitise(TEXT[data.locale].contractTitle));
  doc.setAuthor(sanitise(data.parties.lenderName));
  doc.setProducer("Eichen");
  doc.setCreator("Eichen");
  doc.setCreationDate(data.contractDate);
  doc.setLanguage(data.locale);
}

/** The credit agreement, as it is presented for signature. */
export async function renderContractPdf(data: ContractData): Promise<Buffer> {
  const text = TEXT[data.locale];
  const doc = await PDFDocument.create();
  const fonts = await assetsOf(doc);
  describe(doc, data, text.contractTitle);

  const writer = new Writer(doc, fonts, `${text.contractTitle} - ${data.reference}`);
  writer.title(text.contractTitle);
  writer.space(6);
  writer.rows(partyRows(data));

  writer.heading(text.section1);
  writer.paragraph(text.payout);

  writer.heading(text.section2);
  writer.rows(costRows(data));
  writer.paragraph(`${text.nominalRateNote} ${text.effectiveRateNote} ${text.totalPayableNote}`, {
    size: SIZE.small,
    color: MUTED,
  });

  writer.heading(text.section3);
  writer.rows(repaymentRows(data));

  writer.heading(text.section4);
  writer.paragraph(text.earlyRepayment);

  writer.heading(text.section5);
  writer.paragraph(text.withdrawal);
  writer.space(4);
  writer.paragraph(
    `${text.withdrawalUntil} ${formatDate(data.withdrawalUntil, data.locale)}.`,
    { bold: true },
  );

  writer.heading(text.section6);
  writer.paragraph(defaultInterestParagraph(data));

  writer.heading(text.section7);
  writer.paragraph(insuranceParagraph(data));

  writer.heading(text.section8);
  writer.paragraph(`${text.supervision} ${data.parties.supervisionNote}`);

  writer.heading(text.scheduleTitle);
  writer.table(
    [text.colIndex, text.colDueDate, text.colPayment, text.colInterest, text.colPrincipal, text.colBalance],
    scheduleRows(data),
    [0.07, 0.17, 0.19, 0.19, 0.19, 0.19],
  );

  return Buffer.from(await doc.save());
}

/** The European Standard Information sheet, handed over before signature. */
export async function renderEsisPdf(data: ContractData): Promise<Buffer> {
  const text = TEXT[data.locale];
  const doc = await PDFDocument.create();
  const fonts = await assetsOf(doc);
  describe(doc, data, text.esisTitle);

  const writer = new Writer(doc, fonts, `${text.esisTitle} - ${data.reference}`);
  writer.title(text.esisTitle);
  writer.space(6);
  writer.rows([
    [text.lender, data.parties.lenderName],
    [text.reference, data.reference],
  ]);

  writer.heading(text.section2);
  writer.rows(costRows(data));

  writer.heading(text.section3);
  writer.rows(repaymentRows(data));

  writer.heading(text.section4);
  writer.paragraph(text.earlyRepayment);

  writer.heading(text.section5);
  writer.paragraph(text.withdrawal);

  writer.heading(text.section6);
  writer.paragraph(defaultInterestParagraph(data));

  writer.heading(text.section8);
  writer.paragraph(text.supervision);

  return Buffer.from(await doc.save());
}

export interface SignatureEvidence {
  reference: string;
  signerName: string;
  signedAt: Date;
  /** The PNG the borrower drew. */
  image: Buffer;
  documentHash: string;
  signatureHash: string;
  evidenceHash: string;
}

/**
 * Adds the signature page to the contract that was actually signed.
 *
 * The deed is not re-rendered: the stored bytes are loaded and a page is
 * appended to them. That is what keeps `documentHash` meaningful — the pages
 * above the signature are, byte for byte, the pages the borrower read, and a
 * regeneration that quietly picked up today's date could not claim as much.
 */
export async function appendSignaturePage(
  contractPdf: Buffer,
  evidence: SignatureEvidence,
  locale: Locale,
): Promise<Buffer> {
  const doc = await PDFDocument.load(contractPdf);
  const fonts = await assetsOf(doc);
  const labels = SIGNATURE_TEXT[locale];
  const text = TEXT[locale];

  const writer = new Writer(doc, fonts, `${text.contractTitle} - ${evidence.reference}`);
  writer.title(labels.title);
  writer.space(8);
  writer.paragraph(labels.intro);
  writer.space(6);

  // The drawing is decoded defensively. By the time this runs the signature
  // has been accepted and its hash recorded, so a PNG no decoder will take —
  // an exotic browser, a corrupted upload — must not undo a concluded
  // contract. The page is then drawn without the picture; what proves the act
  // is the evidence hash below, which commits to those same bytes either way.
  let image: PDFImage | null = null;
  try {
    image = await doc.embedPng(evidence.image);
  } catch {
    image = null;
  }

  writer.signature(image, {
    drawn: labels.drawn,
    name: evidence.signerName,
    when: `${labels.signedAt} ${formatDateTime(evidence.signedAt, locale)}`,
  });

  writer.heading(labels.evidenceTitle);
  writer.paragraph(labels.evidenceNote, { size: SIZE.small, color: MUTED });
  writer.space(6);
  // Broken into halves: a 64-character hash on one line at this size would set
  // in type too small to copy off a printed page.
  writer.rows([
    [labels.documentHash, split(evidence.documentHash)],
    [labels.signatureHash, split(evidence.signatureHash)],
    [labels.evidenceHash, split(evidence.evidenceHash)],
  ]);

  return Buffer.from(await doc.save());
}

function split(hash: string): string {
  return `${hash.slice(0, 32)} ${hash.slice(32)}`;
}
