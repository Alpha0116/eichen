import { redirect } from "next/navigation";
import { Alert, ButtonLink, Card, EmptyState, KeyValue, SectionHeading } from "@/components/ui";
import { funnelStep, type ApplicationState } from "@/domain/application/states";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { requireApplicationAccess } from "@/server/access";
import { db } from "@/server/db";
import { latestContract } from "@/server/services/contract";
import { offerFor } from "@/server/services/offers";
import { signContractAction } from "../../actions";
import { SignForm } from "./SignForm";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const [application, contract, chosen, primary] = await Promise.all([
    db.application.findUniqueOrThrow({ where: { id }, select: { state: true } }),
    latestContract(id),
    offerFor(id),
    db.applicant.findUnique({
      where: { applicationId_role: { applicationId: id, role: "PRIMARY" } },
    }),
  ]);

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.contract;
  const state = application.state as ApplicationState;

  // Before approval there is no contract to look at; the status page is the
  // honest answer to "where is my file".
  if (funnelStep(state) < 3) redirect(`/${locale}/apply/${id}/status`);

  if (!contract) {
    return <EmptyState title={dictionary.applicationStatus.APPROVED} body={t.precontractualBody} />;
  }

  const signed = contract.status === "SIGNED";

  const sign = signContractAction.bind(null, locale, id);
  const quote = chosen?.offer?.quote;
  const insured = chosen?.row.insuranceSelected && quote?.withInsurance;
  const variant = insured ? quote!.withInsurance! : quote?.base;

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 sm:p-6">
        <SectionHeading title={t.precontractualTitle} description={t.precontractualBody} level={2} />
        <ul className="flex flex-wrap gap-4 text-sm">
          <li>
            <a
              href={`/api/contract/${id}/esis`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {t.downloadEsis}
            </a>
          </li>
          <li>
            <a
              href={`/api/contract/${id}/contract`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {t.downloadDraft}
            </a>
          </li>
        </ul>
      </Card>

      {quote && variant ? (
        <Card className="p-5 sm:p-6">
          <SectionHeading title={t.summaryTitle} level={3} />
          <div className="mt-3">
            <KeyValue
              rows={[
                { label: dictionary.offers.netAmount, value: formatMoney(quote.netAmount, typedLocale) },
                {
                  label: dictionary.offers.term,
                  value: `${formatNumber(quote.termMonths, typedLocale)} ${dictionary.common.months}`,
                },
                { label: dictionary.offers.instalment, value: formatMoney(variant.instalment, typedLocale) },
                {
                  label: dictionary.offers.nominalRate,
                  value: formatPercent(quote.nominalAnnualRate, typedLocale),
                },
                {
                  label: dictionary.offers.effectiveRate,
                  value: formatPercent(quote.effectiveAnnualRate, typedLocale),
                },
                { label: dictionary.offers.totalPayable, value: formatMoney(variant.totalPayable, typedLocale) },
                {
                  label: dictionary.simulator.firstDueDate,
                  value: formatDate(quote.firstDueDate, typedLocale),
                },
              ]}
            />
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-5 sm:p-6">
        <SectionHeading title={signed ? t.signedSectionTitle : t.signTitle} level={2} />
        {signed ? (
          <>
            <Alert tone="positive" title={t.signedTitle}>
              <p>{t.signedBody}</p>
              {contract.signedAt ? (
                <p className="mt-2 tabular">
                  {interpolate(t.signedAt, { date: formatDate(contract.signedAt, typedLocale) })}
                </p>
              ) : null}
              {contract.withdrawalUntil ? (
                <p className="mt-2">
                  {interpolate(t.withdrawalBody, {
                    date: formatDate(contract.withdrawalUntil, typedLocale),
                  })}
                </p>
              ) : null}
            </Alert>
            {/* The stroke the borrower actually drew, beside the proof that
                binds it to these exact document bytes. Showing the hash next
                to the image is what makes "this is what you signed" checkable
                rather than merely asserted. */}
            <figure className="space-y-2">
              {/* A plain <img>, not next/image: the source is an access-checked
                  route that returns `no-store` and audits every read, so it
                  must not be fetched and cached by the image optimiser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/contract/${id}/signature`}
                alt={dictionary.contract.drawLabel}
                className="h-32 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-2"
              />
              <figcaption className="tabular text-xs text-[var(--muted)]">
                {dictionary.contract.evidenceHash}: {contract.evidenceHash?.slice(0, 24)}…
              </figcaption>
            </figure>

            {/* The signed contract is the deliverable of this step, so it gets
                a button rather than one more link in the list above. */}
            <div className="flex flex-wrap gap-3">
              <ButtonLink
                href={`/api/contract/${id}/contract`}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
              >
                {t.downloadSigned}
              </ButtonLink>
              {funnelStep(state) >= 4 ? (
                <ButtonLink href={`/${locale}/apply/${id}/fee`}>{t.toFee}</ButtonLink>
              ) : null}
            </div>
          </>
        ) : (
          <SignForm
            dictionary={dictionary}
            action={sign}
            signerName={primary ? `${primary.firstName} ${primary.lastName}`.trim() : ""}
          />
        )}
      </Card>

      <Card className="space-y-2 p-5">
        <SectionHeading title={t.withdrawalTitle} level={3} />
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {interpolate(t.withdrawalBody, {
            date: contract.withdrawalUntil
              ? formatDate(contract.withdrawalUntil, typedLocale)
              : "—",
          })}
        </p>
      </Card>

      <Card className="space-y-2 p-5">
        <SectionHeading title={t.paperTitle} description={t.paperBody} level={3} />
      </Card>
    </div>
  );
}
