import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { funnelStep, type ApplicationState } from "@/domain/application/states";
import type { CurrencyCode } from "@/domain/finance/money";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatMoney } from "@/i18n/format";
import { requireApplicationAccess } from "@/server/access";
import { db } from "@/server/db";
import { accountFee } from "@/server/services/accountFee";
import { DisbursementProgress } from "./DisbursementProgress";

/**
 * Step 5. The wait between a settled fee and a payout.
 *
 * The loading indicator is the foreground; behind it sits the receipt for what
 * was just paid — amount, reference, method, date. A spinner on an empty
 * screen after a payment tells the borrower nothing about whether the money
 * left their account, which is the one thing they want to know.
 *
 * The page refreshes itself rather than polling over JavaScript: it is a
 * server component, so a plain meta refresh brings back a freshly rendered
 * state and the page still works with scripting off.
 */
export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const [application, fee] = await Promise.all([
    db.application.findUniqueOrThrow({
      where: { id },
      select: { state: true, reference: true, grantedAmount: true, amount: true, loan: true },
    }),
    accountFee(id),
  ]);

  const state = application.state as ApplicationState;
  if (funnelStep(state) < 5) redirect(`/${locale}/apply/${id}/fee`);

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.funnel.processing;
  const settled = state === "DISBURSED" || state === "ACTIVE";

  return (
    <div className="space-y-6">
      {/* Auto-refresh only while there is something to wait for. Left running
          after disbursement it would reload a finished page for ever. */}
      {settled ? null : <meta httpEquiv="refresh" content="10" />}

      <Card elevation="md" className="relative isolate overflow-hidden">
        {/* The paid fee, sitting behind the status as a watermark: present,
            readable, and plainly not the thing being waited on. */}
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-light)] via-[var(--surface)] to-[var(--accent-soft)]" />
          {fee ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="select-none text-[22vw] font-bold leading-none tracking-tighter text-[var(--primary)] opacity-[0.06] sm:text-[9rem]">
                {formatMoney(fee.amount, typedLocale, fee.currency as CurrencyCode, { showDecimals: false })}
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 p-6 sm:p-10">
          <div className="space-y-4">
            <div>
              <h2 className="text-[length:var(--text-h2)] font-semibold tracking-tight">
                {settled ? t.doneTitle : t.title}
              </h2>
              <p
                className="mt-1 text-sm leading-relaxed text-[var(--muted)]"
                role="status"
                aria-live="polite"
              >
                {settled ? t.doneBody : t.body}
              </p>
            </div>
            {/* The bar stays put until an administrator confirms the transfer
                in the back office; nothing on this page can fill it. */}
            <DisbursementProgress
              dictionary={dictionary}
              settled={settled}
              startedAt={fee?.paidAt ?? null}
            />
          </div>

          {fee ? (
            <dl className="grid gap-x-6 gap-y-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]/85 p-5 text-sm backdrop-blur-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feeAmount}</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold text-[var(--figure-emphasis)]">
                  {formatMoney(fee.amount, typedLocale, fee.currency as CurrencyCode)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feeReference}</dt>
                <dd className="tabular mt-0.5 font-medium">{fee.reference}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feeMethod}</dt>
                <dd className="mt-0.5 font-medium">
                  {/* A fee settled with support has no card behind it, so it
                      says how it was arranged rather than showing a dash. */}
                  {fee.cardLast4
                    ? interpolate(dictionary.fee.cardOnFile, {
                        brand: fee.cardBrand ?? "",
                        last4: fee.cardLast4,
                      })
                    : fee.method
                      ? dictionary.fee.manualOnFile
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feePaidAt}</dt>
                <dd className="tabular mt-0.5 font-medium">
                  {fee.paidAt ? formatDate(fee.paidAt, typedLocale) : "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          <p className="text-xs text-[var(--muted)]">
            {settled
              ? interpolate(t.doneHint, { reference: application.reference })
              : t.refreshHint}
          </p>

          {settled ? (
            <Link
              href={`/${locale}/account`}
              className="inline-flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--accent)] px-7 py-3 text-[0.95rem] font-medium text-[var(--accent-ink)] transition-all duration-200 ease-out hover:shadow-[var(--shadow-md)]"
            >
              {t.toAccount}
            </Link>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-[length:var(--text-h3)] font-semibold">{dictionary.contact.title}</h3>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{dictionary.contact.waitingBody}</p>
        <ContactButtons dictionary={dictionary} reference={application.reference} />
      </Card>
    </div>
  );
}
