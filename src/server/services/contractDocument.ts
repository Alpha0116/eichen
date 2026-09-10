import type { Quote } from "../../domain/finance/quote";
import { formatDate, formatMoney, formatNumber, formatPercent } from "../../i18n/format";
import type { Locale } from "../../i18n";

export interface ContractParties {
  lenderName: string;
  supervisionNote: string;
  borrowerName: string;
  borrowerAddress: string;
  coBorrowerName: string | null;
}

export interface ContractData {
  reference: string;
  parties: ContractParties;
  quote: Quote;
  insuranceSelected: boolean;
  purposeLabel: string;
  contractDate: Date;
  withdrawalUntil: Date;
  /** Statutory default interest rate, base rate plus five points. */
  defaultInterestRate: number;
  locale: Locale;
}

/**
 * The wording of the credit agreement and the European Standard Information
 * sheet.
 *
 * The particulars listed here are the ones a consumer credit agreement must
 * state: net amount, term, instalments, borrowing rate, effective annual rate,
 * total amount payable, the withdrawal right, the early-repayment right and
 * the cost of default. They are rendered from the same quote object the offer
 * was priced from, so the contract cannot disagree with what was shown.
 *
 * This module holds the words and the figures only. Laying them out on a page
 * is `contractPdf.ts`, so a change of wording never touches the typography
 * and a change of typography never touches the wording.
 */

export const TEXT = {
  de: {
    contractTitle: "Verbraucherdarlehensvertrag",
    esisTitle: "Europäische Standardinformationen für Verbraucherkredite",
    reference: "Vertragsnummer",
    date: "Vertragsdatum",
    lender: "Darlehensgeberin",
    borrower: "Darlehensnehmerin oder Darlehensnehmer",
    coBorrower: "Zweite darlehensnehmende Person",
    section1: "1. Darlehensbetrag und Auszahlung",
    section2: "2. Zinsen und Kosten",
    section3: "3. Rückzahlung",
    section4: "4. Vorzeitige Rückzahlung",
    section5: "5. Widerrufsrecht",
    section6: "6. Zahlungsverzug",
    section7: "7. Restschuldversicherung",
    section8: "8. Aufsicht und Beschwerden",
    netAmount: "Nettodarlehensbetrag",
    purpose: "Verwendungszweck",
    payout: "Auszahlung auf das von Ihnen angegebene Konto nach Abschluss der Prüfung.",
    nominalRate: "Gebundener Sollzins p. a.",
    nominalRateNote:
      "Der Sollzins ist für die gesamte Laufzeit fest. Eine Anpassung während der Laufzeit ist ausgeschlossen.",
    effectiveRate: "Effektiver Jahreszins p. a.",
    effectiveRateNote:
      "Berechnet nach der Preisangabenverordnung. Er enthält alle verpflichtenden Kosten des Kredits.",
    totalInterest: "Zinsen insgesamt",
    totalPayable: "Gesamtbetrag",
    totalPayableNote: "Summe aus Nettodarlehensbetrag und allen Kosten.",
    term: "Laufzeit",
    monthsUnit: "Monate",
    instalments: "Anzahl der Raten",
    instalment: "Monatliche Rate",
    finalInstalment: "Schlussrate",
    firstDue: "Erste Rate fällig am",
    lastDue: "Letzte Rate fällig am",
    earlyRepayment:
      "Sie können das Darlehen jederzeit ganz oder teilweise vorzeitig zurückzahlen. Die Darlehensgeberin kann dafür eine Vorfälligkeitsentschädigung verlangen. Diese ist nach § 502 BGB begrenzt auf 1 % des vorzeitig zurückgezahlten Betrags, auf 0,5 %, wenn zwischen der vorzeitigen und der vereinbarten Rückzahlung weniger als ein Jahr liegt, und in keinem Fall auf mehr als den Betrag der Zinsen, den Sie im Zeitraum zwischen der vorzeitigen und der vereinbarten Rückzahlung entrichtet hätten.",
    withdrawal:
      "Sie können Ihre Vertragserklärung innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen. Die Frist beginnt nach Vertragsschluss, aber erst, nachdem Sie alle Pflichtangaben nach § 492 Absatz 2 BGB erhalten haben. Der Widerruf ist in Textform zu erklären.",
    withdrawalUntil: "Ihre Widerrufsfrist endet am",
    defaultInterest:
      "Kommen Sie mit Zahlungen in Verzug, wird der ausstehende Betrag mit dem gesetzlichen Verzugszins verzinst. Dieser beträgt derzeit {rate} p. a. Zusätzlich können Kosten der Rechtsverfolgung anfallen.",
    insuranceIncluded:
      "Sie haben sich für eine Restschuldversicherung entschieden. Der einmalige Beitrag von {premium} wird mitfinanziert. Die Versicherung ist keine Voraussetzung für dieses Darlehen und ist im oben genannten effektiven Jahreszins nicht enthalten.",
    insuranceExcluded:
      "Sie haben keine Restschuldversicherung abgeschlossen. Für dieses Darlehen ist keine erforderlich.",
    supervision:
      "Zuständige Aufsichtsbehörde ist die Bundesanstalt für Finanzdienstleistungsaufsicht (BaFin). Beschwerden können Sie an unseren Kundendienst und an die zuständige Schlichtungsstelle richten.",
    scheduleTitle: "Tilgungsplan",
    colIndex: "Nr.",
    colDueDate: "Fällig am",
    colPayment: "Rate",
    colInterest: "Zinsanteil",
    colPrincipal: "Tilgungsanteil",
    colBalance: "Restschuld",
  },
} as const;

export type Row = readonly [label: string, value: string];

function variantOf(data: ContractData) {
  return data.insuranceSelected && data.quote.withInsurance
    ? data.quote.withInsurance
    : data.quote.base;
}

/** The parties, as they are named at the head of the deed. */
export function partyRows(data: ContractData): Row[] {
  const text = TEXT[data.locale];
  const rows: Row[] = [
    [text.reference, data.reference],
    [text.date, formatDate(data.contractDate, data.locale)],
    [text.lender, data.parties.lenderName],
    [text.borrower, `${data.parties.borrowerName}, ${data.parties.borrowerAddress}`],
  ];
  if (data.parties.coBorrowerName) rows.push([text.coBorrower, data.parties.coBorrowerName]);
  return rows;
}

/** Section 2: what the credit costs. */
export function costRows(data: ContractData): Row[] {
  const { quote, locale } = data;
  const variant = variantOf(data);
  const text = TEXT[locale];

  return [
    [text.netAmount, formatMoney(quote.netAmount, locale, quote.currency)],
    [text.purpose, data.purposeLabel],
    [text.nominalRate, formatPercent(quote.nominalAnnualRate, locale)],
    [text.effectiveRate, formatPercent(quote.effectiveAnnualRate, locale)],
    [text.totalInterest, formatMoney(variant.plan.totalInterest, locale, quote.currency)],
    [text.totalPayable, formatMoney(variant.totalPayable, locale, quote.currency)],
  ];
}

/** Section 3: how and when it is repaid. */
export function repaymentRows(data: ContractData): Row[] {
  const { quote, locale } = data;
  const variant = variantOf(data);
  const text = TEXT[locale];

  return [
    [text.term, `${formatNumber(quote.termMonths, locale)} ${text.monthsUnit}`],
    [text.instalments, formatNumber(variant.plan.entries.length, locale)],
    [text.instalment, formatMoney(variant.instalment, locale, quote.currency)],
    [text.finalInstalment, formatMoney(variant.finalInstalment, locale, quote.currency)],
    [text.firstDue, formatDate(quote.firstDueDate, locale)],
    [text.lastDue, formatDate(quote.lastDueDate, locale)],
  ];
}

/**
 * The amortisation table, one row per instalment.
 *
 * Taken from the base plan rather than the insured variant: the schedule shows
 * the repayment of the credit itself, and an insurance premium that was
 * financed is already inside the net amount it starts from.
 */
export function scheduleRows(data: ContractData): string[][] {
  const { quote, locale } = data;
  return quote.base.plan.entries.map((entry) => [
    String(entry.index),
    formatDate(entry.dueDate, locale),
    formatMoney(entry.payment, locale, quote.currency),
    formatMoney(entry.interest, locale, quote.currency),
    formatMoney(entry.principal, locale, quote.currency),
    formatMoney(entry.closingBalance, locale, quote.currency),
  ]);
}

/** The insurance paragraph, which depends on what was actually taken. */
export function insuranceParagraph(data: ContractData): string {
  const text = TEXT[data.locale];
  return data.insuranceSelected && data.quote.withInsurance
    ? text.insuranceIncluded.replace(
        "{premium}",
        formatMoney(data.quote.withInsurance.premium, data.locale, data.quote.currency),
      )
    : text.insuranceExcluded;
}

/** Statutory default interest, with the current rate filled in. */
export function defaultInterestParagraph(data: ContractData): string {
  return TEXT[data.locale].defaultInterest.replace(
    "{rate}",
    formatPercent(data.defaultInterestRate, data.locale),
  );
}
