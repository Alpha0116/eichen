import Link from "next/link";
import { Badge, Button, Card, EmptyState, ProgressBar, SectionHeading } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { isEditable } from "@/domain/application/states";
import { startApplicationAction } from "../actions";
import type { ApplicationState } from "@/domain/application/states";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/i18n/format";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

const STATE_TONE: Partial<Record<ApplicationState, "positive" | "warning" | "danger" | "info">> = {
  APPROVED: "positive",
  DISBURSED: "positive",
  ACTIVE: "positive",
  CLOSED: "neutral" as never,
  DECLINED: "danger",
  WITHDRAWN: "warning",
  EXPIRED: "warning",
};

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale, `/${locale}/account`);
  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;

  const applications = await db.application.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      loan: { include: { instalments: { orderBy: { index: "asc" } } } },
    },
  });

  const loans = applications.filter((application) => application.loan !== null);

  const running = applications.filter(
    (application) => !["CLOSED", "DECLINED", "WITHDRAWN", "EXPIRED"].includes(application.state),
  ).length;

  return (
    <div>
      <PageHeader
        title={dictionary.account.title}
        description={dictionary.account.intro}
        eyebrow={user.email}
        image="/band-desk.webp"
        aside={
          <Link
            href={`/${locale}/account/security`}
            className="inline-flex items-center rounded-[var(--radius-full)] border border-white/40 bg-white/10 px-5 py-2 text-sm text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {dictionary.mfa.securityTitle}
          </Link>
        }
      >
        {/* A running count in the band answers "where do I stand" before the
            reader parses two lists to work it out for themselves. */}
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            {/* "Open", not "all": the list below shows every application ever
                made, so a counter labelled the same as that list but holding a
                smaller number is a discrepancy the reader has to resolve. */}
            <dt className="text-xs uppercase tracking-wide text-white/60">
              {dictionary.account.openApplications}
            </dt>
            <dd className="tabular font-display text-2xl font-bold text-white">
              {formatNumber(running, typedLocale)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-white/60">
              {dictionary.account.loansTitle}
            </dt>
            <dd className="tabular font-display text-2xl font-bold text-white">
              {formatNumber(loans.length, typedLocale)}
            </dd>
          </div>
        </dl>
      </PageHeader>

      <Section tone="surface" className="py-12 sm:py-16">
        <div className="space-y-8">
      <Reveal>
        <SectionHeading title={dictionary.account.loansTitle} level={2} />
      </Reveal>

      {loans.length === 0 ? (
        <EmptyState title={dictionary.account.noLoan} />
      ) : (
        <ul className="space-y-4">
          {loans.map((application) => {
            const loan = application.loan!;
            const paid = loan.instalments.filter((row) => row.status === "PAID").length;
            const next = loan.instalments.find(
              (row) => row.status === "SCHEDULED" || row.status === "DUE",
            );
            return (
              <Card as="li" key={loan.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{loan.lenderName}</h2>
                    <p className="tabular text-xs text-[var(--muted)]">
                      {dictionary.account.loanReference} {loan.reference}
                    </p>
                  </div>
                  <Badge tone={loan.status === "ACTIVE" ? "positive" : "neutral"}>
                    {dictionary.applicationStatus[application.state as ApplicationState]}
                  </Badge>
                </div>

                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {dictionary.account.outstanding}
                    </dt>
                    <dd className="tabular text-lg font-semibold">
                      {formatMoney(next?.openingBalance ?? 0, typedLocale, loan.currency as "EUR")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {dictionary.account.nextInstalment}
                    </dt>
                    <dd className="tabular text-lg font-semibold">
                      {next ? formatMoney(next.amount, typedLocale, loan.currency as "EUR") : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {dictionary.account.nextDueDate}
                    </dt>
                    <dd className="tabular text-lg font-semibold">
                      {next ? formatDate(next.dueDate, typedLocale) : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-1.5">
                  <ProgressBar
                    value={paid}
                    max={loan.instalments.length}
                    label={dictionary.account.progressLabel}
                  />
                  <p className="text-xs text-[var(--muted)]">
                    {interpolate(dictionary.account.instalmentsPaid, {
                      paid: formatNumber(paid, typedLocale),
                      total: formatNumber(loan.instalments.length, typedLocale),
                    })}
                  </p>
                </div>

                <Link
                  href={`/${locale}/account/loan/${loan.id}`}
                  className="inline-block text-sm underline underline-offset-2"
                >
                  {dictionary.common.details} →
                </Link>
              </Card>
            );
          })}
        </ul>
      )}

      <section className="space-y-4 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading title={dictionary.account.applicationsTitle} level={2} />
          {/* Opening an application starts here rather than on the home page:
              the account is where the borrower already is, and where the file
              will live. */}
          <form action={startApplicationAction.bind(null, locale)}>
            <Button type="submit">{dictionary.account.newApplication}</Button>
          </form>
        </div>
        {applications.length === 0 ? (
          <EmptyState title={dictionary.account.noApplication} body={dictionary.account.noApplicationBody} />
        ) : (
          <ul className="space-y-3">
            {applications.map((application) => (
              <Card as="li" key={application.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="tabular text-sm font-medium">{application.reference}</p>
                  <p className="tabular text-xs text-[var(--muted)]">
                    {formatMoney(application.amount, typedLocale, "EUR", { showDecimals: false })} ·{" "}
                    {formatNumber(application.termMonths, typedLocale)} {dictionary.common.months} ·{" "}
                    {formatDate(application.createdAt, typedLocale)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={STATE_TONE[application.state as ApplicationState] ?? "neutral"}>
                    {dictionary.applicationStatus[application.state as ApplicationState]}
                  </Badge>
                  {/* A draft resumes where it is filled in; anything further
                      along opens on its status, which is the page that says
                      what is happening and what to do next. */}
                  <Link
                    href={`/${locale}/apply/${application.id}/${
                      isEditable(application.state as ApplicationState) ? "simulation" : "status"
                    }`}
                    className="text-sm underline underline-offset-2"
                  >
                    {isEditable(application.state as ApplicationState)
                      ? dictionary.account.resume
                      : dictionary.common.details}
                  </Link>
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
        </div>
      </Section>

      <Section tone="muted" className="py-12 sm:py-16">
        <Reveal className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <h2 className="font-display text-[length:var(--text-h3)] font-semibold">
              {dictionary.contact.title}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              {dictionary.contact.body}
            </p>
          </div>
          <ContactButtons dictionary={dictionary} />
        </Reveal>
      </Section>
    </div>
  );
}
