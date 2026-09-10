import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { ContactButtons } from "@/components/ContactButtons";
import { PageHeader } from "@/components/PageHeader";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { funnelStep, FUNNEL_STEP_COUNT, type ApplicationState } from "@/domain/application/states";
import { requireApplicationAccess } from "@/server/access";
import { PRODUCT } from "@/server/config";
import { db } from "@/server/db";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

/**
 * The five steps the borrower is promised, in order. Step 1 spans several
 * pages — the simulation, their details, their documents, the recap — because
 * they are one continuous act of filling the application in; the stepper
 * counts what the borrower waits on, not how many forms there are.
 */
const STEPS = [
  { key: "request", slug: "simulation" },
  { key: "review", slug: "status" },
  { key: "contract", slug: "contract" },
  { key: "fee", slug: "fee" },
  { key: "payout", slug: "processing" },
] as const;

const STATE_TONE: Partial<Record<ApplicationState, "positive" | "warning" | "danger" | "info">> = {
  SUBMITTED: "info",
  APPROVED: "positive",
  CONTRACT_READY: "info",
  SIGNED: "info",
  FEE_PENDING: "warning",
  FEE_PAID: "positive",
  DISBURSED: "positive",
  ACTIVE: "positive",
  DECLINED: "danger",
  DEFAULTED: "danger",
  WITHDRAWN: "warning",
  EXPIRED: "warning",
};

export default async function ApplyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const application = await db.application.findUnique({
    where: { id },
    select: {
      reference: true,
      state: true,
      amount: true,
      termMonths: true,
      purpose: true,
      currency: true,
      grantedAmount: true,
    },
  });
  if (!application) notFound();

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const state = application.state as ApplicationState;
  const current = funnelStep(state);
  // A step is only reachable once the file has got there. Linking a step the
  // borrower cannot act on yet produces a page that tells them to come back
  // later, which is worse than a marker that is plainly not a link.
  const reachable = (position: number) => current > 0 && position <= current;

  return (
    <div className="bg-[var(--surface-muted)]">
      <PageHeader
        title={dictionary.funnel.title}
        eyebrow={application.reference}
        image="/apply-band.webp"
        aside={
          <Badge tone={STATE_TONE[state] ?? "neutral"}>{dictionary.applicationStatus[state]}</Badge>
        }
      >
        {/* The step markers live inside the header band rather than under it:
            they are the reader's position in the process, which is what a page
            header is for, and on the navy they read as progress instead of as
            one more row of chrome on a white page. */}
        <nav aria-label={dictionary.funnel.title} className="no-print">
          <p className="sr-only">
            {interpolate(dictionary.funnel.stepOf, { current, total: FUNNEL_STEP_COUNT })}
          </p>
          <ol className="flex items-start">
            {STEPS.map((step, index) => {
              const position = index + 1;
              const done = position < current;
              const active = position === current;
              const circleTone = done
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                : active
                  ? "border-white bg-white font-semibold text-[var(--primary)]"
                  : "border-white/35 bg-white/10 text-white/60";
              const marker = (
                <>
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm tabular ${circleTone}`}
                  >
                    {done ? <CheckIcon className="h-4 w-4" /> : position}
                  </span>
                  <span
                    className={`max-w-[6.5rem] text-xs leading-tight ${
                      active ? "font-semibold text-white" : "text-white/60"
                    }`}
                  >
                    {dictionary.funnel.steps[step.key]}
                  </span>
                </>
              );

              return (
                <li key={step.key} className="flex flex-1 items-center last:flex-none">
                  {reachable(position) ? (
                    <Link
                      href={`/${locale}/apply/${id}/${step.slug}`}
                      aria-current={active ? "step" : undefined}
                      className="flex flex-col items-center gap-1.5 text-center"
                    >
                      {marker}
                    </Link>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-center">{marker}</span>
                  )}
                  {index < STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className={`mx-1.5 mt-4 h-0.5 flex-1 ${done ? "bg-[var(--accent)]" : "bg-white/25"}`}
                    />
                  ) : null}
                </li>
              );
              })}
            </ol>
        </nav>
      </PageHeader>

      <div className="ds-container grid gap-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">{children}</div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">{dictionary.funnel.steps.request}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{dictionary.simulator.amountLabel}</dt>
                <dd className="tabular font-medium">
                  {formatMoney(application.grantedAmount ?? application.amount, typedLocale, "EUR", {
                    showDecimals: false,
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{dictionary.simulator.termLabel}</dt>
                <dd className="tabular font-medium">
                  {formatNumber(application.termMonths, typedLocale)} {dictionary.common.months}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{dictionary.simulator.rateLabel}</dt>
                <dd className="tabular font-medium text-[var(--rate-accent)]">
                  {formatPercent(PRODUCT.referenceRate, typedLocale)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{dictionary.simulator.purposeLabel}</dt>
                <dd className="font-medium text-right">
                  {dictionary.purpose[application.purpose as keyof typeof dictionary.purpose]}
                </dd>
              </div>
            </dl>
            {current === 1 ? (
              <Link
                href={`/${locale}/apply/${id}/simulation`}
                className="inline-block text-sm underline underline-offset-2"
              >
                {dictionary.common.edit}
              </Link>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4 no-print" lift>
            <h2 className="text-sm font-semibold">{dictionary.contact.title}</h2>
            <p className="text-xs leading-relaxed text-[var(--muted)]">{dictionary.contact.body}</p>
            <ContactButtons
              dictionary={dictionary}
              reference={application.reference}
              size="sm"
              className="flex-col items-stretch [&>a]:w-full"
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
