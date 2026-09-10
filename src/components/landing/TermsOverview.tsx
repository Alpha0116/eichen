import { Card, SectionHeading } from "@/components/ui";
import { priceLoan } from "@/domain/finance/quote";
import type { Dictionary, Locale } from "@/i18n";
import { formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { PRODUCT } from "@/server/config";

const ROWS: { amount: number; termMonths: number }[] = [
  { amount: 200_000, termMonths: 24 },
  { amount: 500_000, termMonths: 36 },
  { amount: 1_000_000, termMonths: 48 },
  { amount: 2_000_000, termMonths: 60 },
  { amount: 3_500_000, termMonths: 84 },
];

/**
 * A representative row per amount/term combination, all priced at the same
 * public reference rate the simulator uses — so this table can never disagree
 * with the number a visitor just saw above it.
 */
export function TermsOverview({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const t = dictionary.landing.termsOverview;
  const drawdownDate = new Date();

  const rows = ROWS.map((row) => {
    const quote = priceLoan({
      netAmount: row.amount,
      termMonths: row.termMonths,
      nominalAnnualRate: PRODUCT.referenceRate,
      currency: PRODUCT.currency,
      drawdownDate,
    });
    return { ...row, quote };
  });

  return (
    <section id="terms" className="scroll-mt-20 space-y-6">
      <SectionHeading title={t.title} description={t.intro} level={2} />
      <Card elevation="md" className="overflow-x-auto p-1">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th scope="col" className="px-5 py-3">
                {t.columns.amount}
              </th>
              <th scope="col" className="px-5 py-3">
                {t.columns.term}
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                {t.columns.rate}
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                {t.columns.instalment}
              </th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((row) => (
              <tr key={`${row.amount}-${row.termMonths}`} className="border-b border-[var(--border)] last:border-0">
                <td className="px-5 py-3 font-medium">
                  {formatMoney(row.amount, locale, PRODUCT.currency, { showDecimals: false })}
                </td>
                <td className="px-5 py-3 text-[var(--muted)]">
                  {formatNumber(row.termMonths, locale)} {dictionary.common.months}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-[var(--rate-accent)]">
                  {formatPercent(row.quote.effectiveAnnualRate, locale)}
                </td>
                <td className="px-5 py-3 text-right font-semibold">
                  {formatMoney(row.quote.base.instalment, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-[var(--muted)]">{t.footnote}</p>
    </section>
  );
}
