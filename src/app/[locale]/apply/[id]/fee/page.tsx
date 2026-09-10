import { redirect } from "next/navigation";
import { Alert, Card, KeyValue, SectionHeading } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { funnelStep, type ApplicationState } from "@/domain/application/states";
import type { CurrencyCode } from "@/domain/finance/money";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatMoney, formatPercent } from "@/i18n/format";
import { requireApplicationAccess } from "@/server/access";
import { ACCOUNT_FEE } from "@/server/config";
import { db } from "@/server/db";
import { accountFee, issueAccountFee } from "@/server/services/accountFee";

/**
 * Step 4. The account fee.
 *
 * The page states the amount, how it was arrived at, and that it is charged
 * once — before asking for it. A fee a borrower cannot check the arithmetic of
 * is a fee they have to take on trust.
 */
export default async function FeePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const application = await db.application.findUniqueOrThrow({
    where: { id },
    select: { state: true, reference: true, amount: true, grantedAmount: true, currency: true },
  });
  const state = application.state as ApplicationState;
  const step = funnelStep(state);

  if (step < 4) redirect(`/${locale}/apply/${id}/status`);
  if (step > 4) redirect(`/${locale}/apply/${id}/processing`);

  // Signature issues the fee, but a file that reached this page without one —
  // an interrupted signature callback, a fee seeded by a script — should not
  // dead-end. Issuing is idempotent, so this cannot produce a second charge.
  const fee = (await accountFee(id)) ?? (await issueAccountFee(id));

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.fee;
  const granted = application.grantedAmount ?? application.amount;

  return (
    <div className="space-y-6">
      <Card elevation="md" className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.title} description={t.intro} level={2} />

        <div className="rounded-[var(--radius-md)] border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.amountDue}</p>
          <p className="tabular mt-1 text-[2.5rem] font-bold leading-none text-[var(--figure-emphasis)]">
            {formatMoney(fee.amount, typedLocale, fee.currency as CurrencyCode)}
          </p>
        </div>

        <KeyValue
          rows={[
            {
              label: t.basis,
              value: interpolate(t.basisValue, {
                rate: formatPercent(ACCOUNT_FEE.rate, typedLocale),
                amount: formatMoney(granted, typedLocale, "EUR", { showDecimals: false }),
              }),
            },
            { label: t.reference, value: fee.reference },
            { label: t.dueBy, value: formatDate(fee.dueBy, typedLocale) },
            {
              label: t.bounds,
              value: interpolate(t.boundsValue, {
                min: formatMoney(ACCOUNT_FEE.minAmount, typedLocale, "EUR"),
                max: formatMoney(ACCOUNT_FEE.maxAmount, typedLocale, "EUR"),
              }),
            },
          ]}
        />

        <Alert variant="outline" tone="accent" title={t.onceTitle}>
          <p>{t.onceBody}</p>
        </Alert>
      </Card>

      {/* Card payment is switched off. The fee is settled with support
          directly, so the step ends in the two ways to reach us rather than in
          a payment form — with the fee's own reference to quote, which is what
          lets support match a payment to this file. */}
      <Card elevation="md" className="space-y-4 p-5 sm:p-6">
        <SectionHeading title={t.contactTitle} description={t.contactIntro} level={3} />
        <Alert variant="outline" tone="accent">
          <p>{interpolate(t.contactReference, { reference: fee.reference })}</p>
        </Alert>
        <ContactButtons dictionary={dictionary} reference={application.reference} />
        <p className="text-sm leading-relaxed text-[var(--muted)]">{dictionary.contact.feeBody}</p>
      </Card>
    </div>
  );
}
