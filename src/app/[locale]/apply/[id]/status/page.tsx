import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, SectionHeading } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import type { ApplicationState } from "@/domain/application/states";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDateTime, formatMoney } from "@/i18n/format";
import { requireApplicationAccess } from "@/server/access";
import { SLA } from "@/server/config";
import { db } from "@/server/db";

/**
 * Step 2 from the borrower's side: what an administrator is doing with the
 * file, and what happens next.
 *
 * Each state names the party the file is waiting on and the one action, if
 * any, the borrower can take. "Under review" with no next step and no date is
 * how a funnel loses people who were going to be approved.
 */
/** Only the flat call-to-action strings; `headings` and `bodies` are records
    and could not be rendered as a label. */
type ActionKey = "toReview" | "toContract" | "toFee" | "toProcessing" | "toAccount";

const NEXT_ACTION: Partial<Record<ApplicationState, { slug: string; key: ActionKey }>> = {
  DRAFT: { slug: "review", key: "toReview" },
  APPROVED: { slug: "contract", key: "toContract" },
  CONTRACT_READY: { slug: "contract", key: "toContract" },
  SIGNED: { slug: "fee", key: "toFee" },
  FEE_PENDING: { slug: "fee", key: "toFee" },
  FEE_PAID: { slug: "processing", key: "toProcessing" },
  DISBURSED: { slug: "processing", key: "toProcessing" },
};

const TONE: Partial<Record<ApplicationState, "positive" | "warning" | "danger" | "info">> = {
  SUBMITTED: "info",
  APPROVED: "positive",
  DECLINED: "danger",
  WITHDRAWN: "warning",
  EXPIRED: "warning",
};

export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const application = await db.application.findUniqueOrThrow({
    where: { id },
    select: {
      state: true,
      reference: true,
      amount: true,
      grantedAmount: true,
      currency: true,
      submittedAt: true,
      decidedAt: true,
      schufaOptIn: true,
    },
  });

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.funnel.status;
  const state = application.state as ApplicationState;
  const next = NEXT_ACTION[state] ?? null;

  // Only shown while the file is genuinely with an administrator: a target
  // that has already been met, or no longer applies, is noise.
  const slaTarget =
    state === "SUBMITTED" && application.submittedAt
      ? new Date(application.submittedAt.getTime() + SLA.manualDecisionHours * 3_600_000)
      : null;

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading title={t.headings[state]} description={t.bodies[state]} level={2} />
          <Badge tone={TONE[state] ?? "neutral"}>{dictionary.applicationStatus[state]}</Badge>
        </div>

        <dl className="grid gap-x-6 gap-y-3 border-t border-[var(--border)] pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.reference}</dt>
            <dd className="tabular mt-0.5 font-medium">{application.reference}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.amount}</dt>
            <dd className="tabular mt-0.5 font-medium">
              {formatMoney(application.grantedAmount ?? application.amount, typedLocale, "EUR", {
                showDecimals: false,
              })}
            </dd>
          </div>
          {application.submittedAt ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.submittedAt}</dt>
              <dd className="tabular mt-0.5 font-medium">
                {formatDateTime(application.submittedAt, typedLocale)}
              </dd>
            </div>
          ) : null}
          {application.decidedAt ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.decidedAt}</dt>
              <dd className="tabular mt-0.5 font-medium">
                {formatDateTime(application.decidedAt, typedLocale)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.schufa}</dt>
            <dd className="mt-0.5 font-medium">
              {application.schufaOptIn ? dictionary.common.yes : dictionary.common.no}
            </dd>
          </div>
        </dl>

        {slaTarget ? (
          <Alert variant="outline" tone="info">
            <p>{interpolate(t.slaNotice, { deadline: formatDateTime(slaTarget, typedLocale) })}</p>
          </Alert>
        ) : null}

        {next ? (
          <ButtonLink href={`/${locale}/apply/${id}/${next.slug}`}>{t[next.key]}</ButtonLink>
        ) : null}

        {state === "DECLINED" ? (
          <p className="text-sm">
            <Link href={`/${locale}/account`} className="underline underline-offset-2">
              {t.toAccount}
            </Link>
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-[length:var(--text-h3)] font-semibold">{dictionary.contact.title}</h3>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{dictionary.contact.waitingBody}</p>
        <ContactButtons dictionary={dictionary} reference={application.reference} />
      </Card>
    </div>
  );
}
