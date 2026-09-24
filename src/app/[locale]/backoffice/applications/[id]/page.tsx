import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, Figure, KeyValue, SectionHeading } from "@/components/ui";
import { funnelStep, type ApplicationState } from "@/domain/application/states";
import type { CurrencyCode } from "@/domain/finance/money";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { requireStaff } from "@/server/access";
import { verifyApplicationChain } from "@/server/audit";
import { db } from "@/server/db";
import { latestDecision, outstandingDocuments } from "@/server/services/backoffice";
import { documentsFor, REJECTION_CODES } from "@/server/services/documents";
import {
  confirmFeePaymentAction,
  deleteApplicationAction,
  disburseAction,
  finaliseDecisionAction,
  returnApplicationAction,
  resetTransferAttemptsAction,
  reviewDocumentAction,
  saveClientAccountAction,
} from "../../actions";
import { accountFee } from "@/server/services/accountFee";
import {
  accountSpaceDetails,
  clientAccountFor,
  transferCodeFor,
  TRANSFER_CODE_MAX_ATTEMPTS,
} from "@/server/services/accountSpace";
import {
  ClientAccountForm,
  ConfirmFeeForm,
  DeleteForm,
  DisburseForm,
  FinaliseForm,
  ReturnForm,
} from "./DecisionForms";

const OUTCOME_TONE = { ACCEPT: "positive", REFER: "warning", DECLINE: "danger" } as const;

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireStaff(locale);

  const [application, decision, documents, chain, outstanding, fee] = await Promise.all([
    db.application.findUnique({
      where: { id },
      include: {
        applicants: true,
        household: true,
        consents: { orderBy: { grantedAt: "desc" } },
        offers: { orderBy: { effectiveAnnualRate: "asc" } },
        loan: true,
        contracts: { orderBy: { version: "desc" }, take: 1 },
        identityChecks: { orderBy: { startedAt: "desc" } },
      },
    }),
    latestDecision(id),
    documentsFor(id),
    verifyApplicationChain(id),
    outstandingDocuments(id),
    accountFee(id),
  ]);
  if (!application) notFound();

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.backoffice;
  const state = application.state as ApplicationState;

  const primary = application.applicants.find((row) => row.role === "PRIMARY");
  const co = application.applicants.find((row) => row.role === "CO_BORROWER");
  const selected = application.offers.find((offer) => offer.selectedAt !== null);
  const reviewDoc = reviewDocumentAction.bind(null, locale, id);
  const deleteThis = deleteApplicationAction.bind(null, locale, id);
  const finalise = finaliseDecisionAction.bind(null, locale, id);
  const disburseNow = disburseAction.bind(null, locale, id);
  const confirmFee = confirmFeePaymentAction.bind(null, locale, id);
  const returnToCustomer = returnApplicationAction.bind(null, locale, id);
  const reasonText = dictionary.reason as unknown as Record<string, string>;
  // Only once the borrower has an account space to transfer from; before
  // that there is nothing a code could release.
  const onAccountSpace = funnelStep(state) >= 5;
  const [transferCode, clientAccount] = onAccountSpace
    ? await Promise.all([transferCodeFor(id), accountSpaceDetails().then((d) => clientAccountFor(id, d))])
    : [null, null];
  const transferLocked = application.transferCodeAttempts >= TRANSFER_CODE_MAX_ATTEMPTS;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title={interpolate(t.detailTitle, { reference: application.reference })}
          level={2}
        />
        <Badge tone="neutral">{dictionary.applicationStatus[state]}</Badge>
      </div>

      {/* An audit trail that no longer verifies is the single most important
          thing an agent opening this file needs to be told. */}
      {chain.valid ? (
        <p className="text-xs text-[var(--muted)]">
          {interpolate(t.auditIntact, { count: chain.count })}
        </p>
      ) : (
        <Alert tone="danger">{interpolate(t.auditBroken, { sequence: chain.brokenAt ?? 0 })}</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="space-y-3 p-5">
            <SectionHeading title={t.tabs.overview} level={3} />
            <KeyValue
              rows={[
                { label: t.reference, value: application.reference },
                {
                  label: t.applicant,
                  value: primary ? `${primary.firstName} ${primary.lastName}` : "—",
                },
                {
                  label: dictionary.funnel.profile.birthDate,
                  value: primary?.birthDate ? formatDate(primary.birthDate, typedLocale) : "—",
                },
                { label: t.amount, value: formatMoney(application.amount, typedLocale) },
                {
                  label: t.grantedAmount,
                  value: formatMoney(application.grantedAmount ?? application.amount, typedLocale),
                },
                {
                  label: dictionary.offers.term,
                  value: `${formatNumber(application.termMonths, typedLocale)} ${dictionary.common.months}`,
                },
                {
                  label: dictionary.simulator.purposeLabel,
                  value: dictionary.purpose[application.purpose as keyof typeof dictionary.purpose],
                },
                { label: t.createdAt, value: formatDateTime(application.createdAt, typedLocale) },
                { label: t.schufaRequested, value: application.schufaOptIn ? dictionary.common.yes : dictionary.common.no },
              ]}
            />
          </Card>

          <Card className="space-y-3 p-5">
            <SectionHeading title={t.contactTitle} level={3} />
            <KeyValue
              rows={[
                { label: dictionary.funnel.profile.email, value: primary?.email ?? "—" },
                { label: dictionary.funnel.profile.phone, value: primary?.phone ?? "—" },
                { label: dictionary.funnel.profile.street, value: primary?.street ?? "—" },
                {
                  label: dictionary.funnel.profile.city,
                  value: primary ? `${primary.postalCode} ${primary.city}` : "—",
                },
                { label: dictionary.funnel.profile.country, value: primary?.country ?? "—" },
                {
                  label: dictionary.funnel.profile.residentSince,
                  value: formatNumber(primary?.residentSinceMonths ?? 0, typedLocale),
                },
              ]}
            />
          </Card>

          <Card className="space-y-3 p-5">
            <SectionHeading title={t.employmentTitle} level={3} />
            <KeyValue
              rows={[
                {
                  label: dictionary.funnel.finances.employmentType,
                  value: primary
                    ? dictionary.employment[primary.employmentType as keyof typeof dictionary.employment]
                    : "—",
                },
                { label: dictionary.funnel.finances.employer, value: primary?.employerName || "—" },
                {
                  label: dictionary.funnel.finances.employedSince,
                  value: formatNumber(primary?.employedSinceMonths ?? 0, typedLocale),
                },
                {
                  label: dictionary.funnel.finances.employmentEndsOn,
                  value: primary?.employmentEndsOn
                    ? formatDate(primary.employmentEndsOn, typedLocale)
                    : "—",
                },
                {
                  label: dictionary.funnel.finances.netIncome,
                  value: formatMoney(primary?.netMonthlyIncome ?? 0, typedLocale),
                },
                {
                  label: dictionary.funnel.finances.otherIncome,
                  value: formatMoney(primary?.otherMonthlyIncome ?? 0, typedLocale),
                },
              ]}
            />
          </Card>

          <Card className="space-y-3 p-5">
            <SectionHeading title={t.householdTitle} level={3} />
            <KeyValue
              rows={[
                {
                  label: dictionary.funnel.finances.adults,
                  value: formatNumber(application.household?.adults ?? 0, typedLocale),
                },
                {
                  label: dictionary.funnel.finances.children,
                  value: formatNumber(application.household?.children ?? 0, typedLocale),
                },
                {
                  label: dictionary.funnel.finances.housingStatus,
                  value: application.household
                    ? dictionary.housing[application.household.housingStatus as keyof typeof dictionary.housing]
                    : "—",
                },
                {
                  label: dictionary.funnel.finances.housingCost,
                  value: formatMoney(application.household?.monthlyHousingCost ?? 0, typedLocale),
                },
                {
                  label: dictionary.funnel.finances.existingInstalments,
                  value: formatMoney(application.household?.existingLoanInstalments ?? 0, typedLocale),
                },
                {
                  label: dictionary.funnel.finances.otherCosts,
                  value: formatMoney(application.household?.otherFixedCosts ?? 0, typedLocale),
                },
              ]}
            />
          </Card>

          {/* The account the payout goes to, in full: this desk is where the
              transfer is made from, and half an IBAN cannot be transferred to. */}
          <Card className="space-y-3 p-5">
            <SectionHeading title={t.bankTitle} level={3} />
            <KeyValue
              rows={[
                { label: dictionary.funnel.bank.bankName, value: application.bankName ?? "—" },
                {
                  label: t.ibanFull,
                  value: application.iban ? (
                    <span className="select-all break-all">{application.iban}</span>
                  ) : (
                    (application.maskedIban ?? t.ibanMissing)
                  ),
                },
              ]}
            />
          </Card>

          {co ? (
            <Card className="space-y-3 p-5">
              <SectionHeading title={t.coBorrowerTitle} level={3} />
              <KeyValue
                rows={[
                  { label: t.applicant, value: `${co.firstName} ${co.lastName}` },
                  {
                    label: dictionary.funnel.profile.birthDate,
                    value: co.birthDate ? formatDate(co.birthDate, typedLocale) : "—",
                  },
                  { label: dictionary.funnel.profile.email, value: co.email || "—" },
                  { label: dictionary.funnel.profile.phone, value: co.phone || "—" },
                  {
                    label: dictionary.funnel.finances.employmentType,
                    value: dictionary.employment[co.employmentType as keyof typeof dictionary.employment],
                  },
                  {
                    label: dictionary.funnel.finances.netIncome,
                    value: formatMoney(co.netMonthlyIncome, typedLocale),
                  },
                ]}
              />
            </Card>
          ) : null}
        </div>

        <Card className="space-y-4 p-5">
          <SectionHeading title={t.decisionTitle} level={3} />
          {decision ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={OUTCOME_TONE[decision.outcome]}>{t.outcome[decision.outcome]}</Badge>
                <Figure label={t.decisionScore} value={formatNumber(decision.score, typedLocale)} />
                <Figure label={t.decisionGrade} value={decision.grade ?? "—"} />
                <Figure
                  label={t.decisionRuleSet}
                  value={`${decision.ruleSetKey} v${decision.ruleSetVersion}`}
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold">{t.firedRules}</h4>
                <ul className="mt-2 space-y-1 text-sm">
                  {decision.firedRules.map((rule) => (
                    <li key={rule.key} className="flex items-baseline justify-between gap-3">
                      <span>
                        <code className="text-xs">{rule.key}</code>{" "}
                        <span className="text-[var(--muted)]">
                          {reasonText[rule.reasonCode.replace("reason.", "")] ?? rule.reasonCode}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xs">
                        {rule.effect}
                        {rule.points !== 0 ? ` ${rule.points > 0 ? "+" : ""}${rule.points}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium">{t.factsTitle}</summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  {Object.entries(decision.facts).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2 border-b border-[var(--border)] py-0.5">
                      <dt className="text-[var(--muted)]">{key}</dt>
                      <dd className="tabular font-medium">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">{t.noDecision}</p>
          )}
        </Card>
      </div>

      <Card className="space-y-4 p-5">
        <SectionHeading title={t.tabs.documents} level={3} />
        {documents.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{dictionary.documents.none}</p>
        ) : (
          <ul className="space-y-3">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {dictionary.documents.kinds[document.kind as keyof typeof dictionary.documents.kinds]}
                  </p>
                  <p className="tabular truncate text-xs text-[var(--muted)]">
                    {document.filename} · {formatDateTime(document.uploadedAt, typedLocale)} ·{" "}
                    {document.sha256.slice(0, 12)}…
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline underline-offset-2"
                  >
                    {t.openDocument}
                  </a>
                  {/* The same bytes, saved rather than looked at: a scan that
                      has to be forwarded or filed is not read in a tab. */}
                  <a
                    href={`/api/documents/${document.id}?download=1`}
                    download={document.filename}
                    className="text-sm underline underline-offset-2"
                  >
                    {dictionary.common.download}
                  </a>
                  <Badge
                    tone={
                      document.status === "VALIDATED"
                        ? "positive"
                        : document.status === "REJECTED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {dictionary.documents.status[document.status as keyof typeof dictionary.documents.status]}
                  </Badge>
                  {document.status !== "VALIDATED" ? (
                    <form action={reviewDoc} className="flex items-center gap-2">
                      <input type="hidden" name="documentId" value={document.id} />
                      <select
                        name="rejectionCode"
                        aria-label={dictionary.documents.status.REJECTED}
                        className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-xs"
                      >
                        {REJECTION_CODES.map((code) => (
                          <option key={code} value={code}>
                            {dictionary.documents.rejection[code]}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" name="decision" value="VALIDATED" size="sm">
                        {t.approveDocument}
                      </Button>
                      <Button type="submit" name="decision" value="REJECTED" size="sm" variant="danger">
                        {t.rejectDocument}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <SectionHeading title={t.tabs.consents} level={3} />
          <ul className="space-y-2 text-sm">
            {application.consents.map((consent) => (
              <li key={consent.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <code className="text-xs">{consent.purpose}</code> v{consent.version} ·{" "}
                  <span className="text-[var(--muted)]">{consent.locale}</span>
                </span>
                <span className="tabular text-xs text-[var(--muted)]">
                  {dictionary.consent.grantedOn} {formatDateTime(consent.grantedAt, typedLocale)}
                  {consent.revokedAt
                    ? ` · ${dictionary.consent.revokedOn} ${formatDateTime(consent.revokedAt, typedLocale)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4 p-5">
          <SectionHeading title={t.selectedOffer} level={3} />
          {selected ? (
            <KeyValue
              rows={[
                { label: dictionary.offers.title, value: selected.lenderName },
                {
                  label: dictionary.offers.effectiveRate,
                  value: formatPercent(selected.effectiveAnnualRate, typedLocale),
                },
                {
                  label: dictionary.offers.instalment,
                  value: formatMoney(selected.instalment, typedLocale),
                },
                {
                  label: dictionary.offers.totalPayable,
                  value: formatMoney(selected.totalPayable, typedLocale),
                },
              ]}
            />
          ) : (
            <p className="text-sm text-[var(--muted)]">{t.noOfferSelected}</p>
          )}

          {/* A file is decided once, while it is SUBMITTED. Afterwards the
              decision is history, and the only remaining staff action is the
              payout once the fee has settled. */}
          {state === "SUBMITTED" ? (
            <div className="space-y-6 border-t border-[var(--border)] pt-5">
              <FinaliseForm
                dictionary={dictionary}
                action={finalise}
                requestedAmount={(application.amount / 100).toFixed(2)}
                outstandingDocuments={outstanding}
              />
              <ReturnForm dictionary={dictionary} action={returnToCustomer} />
            </div>
          ) : null}
          {/* The fee is settled with support, so nothing on the borrower's
              side can move the file off FEE_PENDING. This button is that
              step. */}
          {state === "FEE_PENDING" && fee ? (
            <div className="border-t border-[var(--border)] pt-5">
              <ConfirmFeeForm
                dictionary={dictionary}
                action={confirmFee}
                amount={formatMoney(fee.amount, typedLocale, fee.currency as CurrencyCode)}
                reference={fee.reference}
              />
            </div>
          ) : null}
          {state === "FEE_PAID" ? (
            <DisburseForm
              dictionary={dictionary}
              action={disburseNow}
              maskedIban={application.maskedIban}
            />
          ) : null}
          {application.loan ? (
            <Alert tone="positive">
              {dictionary.account.loanReference} {application.loan.reference}
            </Alert>
          ) : null}
        </Card>
      </div>

      {transferCode ? (
        <Card className="space-y-3 p-5">
          <SectionHeading title={t.transferTitle} description={t.transferCodeIntro} level={3} />
          <p className="text-sm">
            <span className="text-[var(--muted)]">{t.transferCode}</span>{" "}
            <span className="tabular text-lg font-semibold tracking-[0.2em]">{transferCode}</span>
          </p>
          <p className="text-sm">
            {application.transferRequestedAt
              ? interpolate(t.transferRequested, {
                  date: formatDateTime(application.transferRequestedAt, typedLocale),
                })
              : t.transferNotRequested}
          </p>
          {application.transferCodeAttempts > 0 && !application.transferRequestedAt ? (
            <p className={`text-sm ${transferLocked ? "font-medium text-[var(--danger)]" : "text-[var(--muted)]"}`}>
              {transferLocked
                ? t.transferLocked
                : interpolate(t.transferAttempts, {
                    count: application.transferCodeAttempts,
                    max: TRANSFER_CODE_MAX_ATTEMPTS,
                  })}
            </p>
          ) : null}
          {transferLocked && !application.transferRequestedAt ? (
            <form action={resetTransferAttemptsAction.bind(null, locale, id)}>
              <Button type="submit" size="sm" variant="secondary">
                {t.transferReset}
              </Button>
            </form>
          ) : null}
          {clientAccount ? (
            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <SectionHeading title={t.clientAccountTitle} description={t.clientAccountIntro} level={3} />
              <ClientAccountForm
                dictionary={dictionary}
                action={saveClientAccountAction.bind(null, locale, id)}
                cardNumber={clientAccount.cardNumber}
                iban={clientAccount.iban}
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-3 border-[var(--danger,#b3261e)]/40 p-5">
        <SectionHeading title={t.deleteTitle} description={t.deleteIntro} level={3} />
        <DeleteForm dictionary={dictionary} action={deleteThis} />
      </Card>

    </div>
  );
}
