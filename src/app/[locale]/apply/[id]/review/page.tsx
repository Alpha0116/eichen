import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, KeyValue, SectionHeading } from "@/components/ui";
import { isEditable, type ApplicationState } from "@/domain/application/states";
import { priceLoan } from "@/domain/finance/quote";
import { getDictionary, type Locale } from "@/i18n";
import { formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { requireApplicationAccess } from "@/server/access";
import { PRODUCT } from "@/server/config";
import { db } from "@/server/db";
import { documentsFor, requiredDocuments } from "@/server/services/documents";
import { submitApplicationAction } from "../../actions";
import { ReviewForm } from "./ReviewForm";

/**
 * Step 1d. Everything the borrower is about to submit, in one place, before
 * it leaves their hands.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const [application, required, documents] = await Promise.all([
    db.application.findUniqueOrThrow({
      where: { id },
      select: {
        state: true,
        amount: true,
        termMonths: true,
        purpose: true,
        currency: true,
        bankName: true,
        maskedIban: true,
        schufaOptIn: true,
        applicants: { where: { role: "PRIMARY" }, take: 1 },
        household: true,
      },
    }),
    requiredDocuments(id),
    documentsFor(id),
  ]);

  if (!isEditable(application.state as ApplicationState)) {
    redirect(`/${locale}/apply/${id}/status`);
  }

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.funnel.review;
  const primary = application.applicants[0];

  const quote = priceLoan({
    netAmount: application.amount,
    termMonths: application.termMonths,
    nominalAnnualRate: PRODUCT.referenceRate,
    currency: "EUR",
    drawdownDate: new Date(),
  });

  const live = documents.filter((document) => document.replacedById === null);
  const missing = required.filter((kind) => !live.some((document) => document.kind === kind));
  const incomplete = primary === undefined || missing.length > 0;

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.title} description={t.intro} level={2} />

        <KeyValue
          rows={[
            {
              label: dictionary.simulator.amountLabel,
              value: formatMoney(application.amount, typedLocale, "EUR", { showDecimals: false }),
            },
            {
              label: dictionary.simulator.termLabel,
              value: `${formatNumber(application.termMonths, typedLocale)} ${dictionary.common.months}`,
            },
            {
              label: dictionary.simulator.purposeLabel,
              value: dictionary.purpose[application.purpose as keyof typeof dictionary.purpose],
            },
            {
              label: dictionary.simulator.nominalRate,
              value: formatPercent(quote.nominalAnnualRate, typedLocale),
            },
            {
              label: dictionary.simulator.effectiveRate,
              value: formatPercent(quote.effectiveAnnualRate, typedLocale),
            },
            {
              label: dictionary.simulator.instalment,
              value: formatMoney(quote.base.instalment, typedLocale),
            },
            {
              label: dictionary.simulator.totalPayable,
              value: formatMoney(quote.base.totalPayable, typedLocale),
            },
          ]}
        />

        <div className="grid gap-6 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">{t.applicantTitle}</h3>
            {primary ? (
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                {primary.firstName} {primary.lastName}
                <br />
                {primary.street}
                <br />
                {primary.postalCode} {primary.city}
                <br />
                {primary.email}
              </p>
            ) : (
              <p className="text-sm text-[var(--danger)]">{t.applicantMissing}</p>
            )}
            <Link
              href={`/${locale}/apply/${id}/profile`}
              className="inline-block text-sm underline underline-offset-2"
            >
              {dictionary.common.edit}
            </Link>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">{dictionary.funnel.bank.title}</h3>
            <p className="tabular text-sm leading-relaxed text-[var(--muted)]">
              {application.bankName ?? "—"}
              <br />
              {application.maskedIban ?? "—"}
            </p>
          </div>
        </div>
      </Card>

      {incomplete ? (
        <Alert tone="warning" title={t.incompleteTitle}>
          <p>{t.incompleteBody}</p>
          {missing.length > 0 ? (
            <ul className="mt-2 list-inside list-disc">
              {missing.map((kind) => (
                <li key={kind}>{dictionary.documents.kinds[kind]}</li>
              ))}
            </ul>
          ) : null}
          <p>
            <Link
              href={`/${locale}/apply/${id}/documents`}
              className="underline underline-offset-2"
            >
              {t.toDocuments}
            </Link>
          </p>
        </Alert>
      ) : null}

      <ReviewForm
        dictionary={dictionary}
        schufaOptIn={application.schufaOptIn}
        action={submitApplicationAction.bind(null, locale, id)}
      />
    </div>
  );
}
