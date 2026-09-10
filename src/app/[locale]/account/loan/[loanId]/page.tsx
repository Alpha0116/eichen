import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, Figure, KeyValue, SectionHeading } from "@/components/ui";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { fromJson } from "@/server/json";
import {
  acceptSettlementAction,
  quoteSettlementAction,
  toggleAutopayAction,
} from "../../actions";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

const INSTALMENT_TONE = {
  SCHEDULED: "neutral",
  DUE: "info",
  PAID: "positive",
  LATE: "warning",
  RETURNED: "danger",
  WAIVED: "neutral",
} as const;

export default async function LoanPage({
  params,
}: {
  params: Promise<{ locale: string; loanId: string }>;
}) {
  const { locale, loanId } = await params;
  const user = await requireUser(locale, `/${locale}/account/loan/${loanId}`);

  const loan = await db.loan.findFirst({
    where: { id: loanId, application: { userId: user.id } },
    include: {
      application: true,
      instalments: { orderBy: { index: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
      settlements: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!loan) notFound();

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const currency = loan.currency as "EUR";
  const t = dictionary.account;

  const paid = loan.instalments.filter((row) => row.status === "PAID").length;
  const next = loan.instalments.find((row) => row.status === "SCHEDULED" || row.status === "DUE");
  const settlement = loan.settlements[0];
  const settlementValid = settlement && settlement.validUntil > new Date() && !settlement.acceptedAt;

  const requestQuote = quoteSettlementAction.bind(null, locale, loanId);
  const toggleAutopay = toggleAutopayAction.bind(null, locale, loanId);
  const accept = settlement
    ? acceptSettlementAction.bind(null, locale, loanId, settlement.id)
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading title={loan.lenderName} description={`${t.loanReference} ${loan.reference}`} level={1} />
        <Badge tone={loan.status === "ACTIVE" ? "positive" : "neutral"}>{loan.status}</Badge>
      </div>

      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Figure
            label={t.outstanding}
            value={formatMoney(next?.openingBalance ?? 0, typedLocale, currency)}
            emphasis
          />
          <Figure
            label={t.nextInstalment}
            value={next ? formatMoney(next.amount, typedLocale, currency) : "—"}
            emphasis
          />
          <Figure label={t.nextDueDate} value={next ? formatDate(next.dueDate, typedLocale) : "—"} />
          <Figure
            label={dictionary.offers.effectiveRate}
            value={formatPercent(loan.effectiveAnnualRate, typedLocale)}
          />
        </dl>
      </Card>

      <Card className="space-y-4 p-5">
        <SectionHeading title={t.earlyRepaymentTitle} description={t.earlyRepaymentBody} level={2} />

        {settlement ? (
          <>
            <KeyValue
              rows={[
                {
                  label: t.settlementOutstanding,
                  value: formatMoney(settlement.outstandingPrincipal, typedLocale, currency),
                },
                {
                  label: t.settlementAccrued,
                  value: formatMoney(settlement.accruedInterest, typedLocale, currency),
                },
                {
                  label: t.settlementCompensation,
                  value: formatMoney(settlement.compensation, typedLocale, currency),
                },
                {
                  label: t.settlementTotal,
                  value: formatMoney(settlement.totalToPay, typedLocale, currency),
                },
                {
                  label: t.settlementSaved,
                  value: formatMoney(settlement.interestSaved, typedLocale, currency),
                },
              ]}
            />
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              {interpolate(t.settlementCapNotice, {
                cap: formatNumber(settlement.compensationCapRate * 100, typedLocale, 1),
              })}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--muted)]">
              {fromJson<string[]>(settlement.reasonsJson, []).map((reason) => (
                <li key={reason}>
                  {
                    t.settlementReason[
                      reason.replace("compensation.", "") as keyof typeof t.settlementReason
                    ]
                  }
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--muted)]">
              {interpolate(t.settlementValidUntil, {
                date: formatDate(settlement.validUntil, typedLocale),
              })}
            </p>

            {settlement.acceptedAt ? (
              <Alert tone="positive">{dictionary.applicationStatus.CLOSED}</Alert>
            ) : settlementValid && accept ? (
              <form action={accept}>
                <Button type="submit">{t.settlementAccept}</Button>
              </form>
            ) : (
              <form action={requestQuote}>
                <Button type="submit" variant="secondary">
                  {t.earlyRepaymentCta}
                </Button>
              </form>
            )}
          </>
        ) : loan.status === "ACTIVE" ? (
          <form action={requestQuote}>
            <Button type="submit">{t.earlyRepaymentCta}</Button>
          </form>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <SectionHeading title={t.documentsTitle} description={t.documentsBody} level={2} />
        <ul className="flex flex-wrap gap-4 text-sm">
          <li>
            <a
              href={`/api/contract/${loan.applicationId}/contract`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {dictionary.account.contractDocument}
            </a>
          </li>
          <li>
            <a
              href={`/api/contract/${loan.applicationId}/esis`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {dictionary.legal.esis}
            </a>
          </li>
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm">{loan.autopayEnabled ? t.autopayOn : t.autopayOff}</p>
          {loan.status === "ACTIVE" ? (
            <form action={toggleAutopay}>
              <Button type="submit" variant="secondary" size="sm">
                {loan.autopayEnabled ? dictionary.consent.revoke : dictionary.common.confirm}
              </Button>
            </form>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <SectionHeading title={t.scheduleTitle} level={2} />
        <p className="text-xs text-[var(--muted)]">
          {interpolate(t.instalmentsPaid, {
            paid: formatNumber(paid, typedLocale),
            total: formatNumber(loan.instalments.length, typedLocale),
          })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th scope="col" className="py-2 pr-3">{dictionary.simulator.scheduleColumns.index}</th>
                <th scope="col" className="py-2 pr-3">{dictionary.simulator.scheduleColumns.dueDate}</th>
                <th scope="col" className="py-2 pr-3 text-right">{dictionary.simulator.scheduleColumns.payment}</th>
                <th scope="col" className="py-2 pr-3 text-right">{dictionary.simulator.scheduleColumns.interest}</th>
                <th scope="col" className="py-2 pr-3 text-right">{dictionary.simulator.scheduleColumns.closing}</th>
                <th scope="col" className="py-2">{dictionary.backoffice.state}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {loan.instalments.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)]">
                  <td className="py-1.5 pr-3">{row.index}</td>
                  <td className="py-1.5 pr-3">{formatDate(row.dueDate, typedLocale)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMoney(row.amount, typedLocale, currency)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMoney(row.interest, typedLocale, currency)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMoney(row.closingBalance, typedLocale, currency)}</td>
                  <td className="py-1.5">
                    <Badge tone={INSTALMENT_TONE[row.status as keyof typeof INSTALMENT_TONE]}>
                      {t.paymentStatus[row.status as keyof typeof t.paymentStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
