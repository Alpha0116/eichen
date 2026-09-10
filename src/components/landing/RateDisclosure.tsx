import { priceLoan } from "@/domain/finance/quote";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { PRODUCT } from "@/server/config";

/**
 * The mandatory representative example for credit advertising that quotes
 * costs (§ 6a PAngV). Its figures come from the same pricing engine that
 * quotes real offers, so this notice cannot drift out of step with the
 * product it is disclosing.
 */
export function RateDisclosure({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const amount = PRODUCT.defaultAmount;
  const termMonths = PRODUCT.defaultTermMonths;
  // The single product rate, read from configuration rather than written out
  // here: a representative example that quotes a rate the product does not
  // offer is precisely the disclosure § 6a PAngV exists to prevent.
  const nominalAnnualRate = PRODUCT.referenceRate;
  const quote = priceLoan({
    netAmount: amount,
    termMonths,
    nominalAnnualRate,
    currency: PRODUCT.currency,
    drawdownDate: new Date(),
  });

  const text = interpolate(dictionary.landing.representativeExample, {
    amount: formatMoney(amount, locale, PRODUCT.currency, { showDecimals: false }),
    term: formatNumber(termMonths, locale),
    nominal: formatPercent(nominalAnnualRate, locale),
    apr: formatPercent(quote.effectiveAnnualRate, locale),
    count: formatNumber(quote.base.plan.entries.length - 1, locale),
    instalment: formatMoney(quote.base.instalment, locale),
    final: formatMoney(quote.base.finalInstalment, locale),
    total: formatMoney(quote.base.totalPayable, locale),
  });

  return (
    <>
      <p className="font-semibold">{dictionary.landing.representativeExampleTitle}</p>
      <p>{text}</p>
    </>
  );
}
