import Link from "next/link";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";
import { APPLICATION_STATES, type ApplicationState } from "@/domain/application/states";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDateTime, formatMoney } from "@/i18n/format";
import { requireStaff } from "@/server/access";
import { queue, queueCounts } from "@/server/services/backoffice";
import { accountSpaceDetails } from "@/server/services/accountSpace";
import { saveAccountSpaceAction } from "./actions";
import { AccountSpaceForm } from "./AccountSpaceForm";

const OUTCOME_TONE = { ACCEPT: "positive", REFER: "warning", DECLINE: "danger" } as const;

export default async function QueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ state?: string; outcome?: string; q?: string }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  await requireStaff(locale);

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;

  // The states an administrator can act on, in the order they act on them.
  // Everything else stays reachable through the dropdown; these are the ones
  // worth a permanent chip.
  const ACTIONABLE: ApplicationState[] = ["SUBMITTED", "FEE_PAID"];

  const [{ items, total }, counts, accountSpace] = await Promise.all([
    queue({
    state: (APPLICATION_STATES as readonly string[]).includes(filters.state ?? "")
      ? (filters.state as ApplicationState)
      : undefined,
    outcome:
      filters.outcome === "ACCEPT" || filters.outcome === "REFER" || filters.outcome === "DECLINE"
        ? filters.outcome
        : undefined,
      query: filters.q,
    }),
    queueCounts(),
    accountSpaceDetails(),
  ]);

  const chips: { label: string; value: string; count: number; tone: "accent" | "neutral" }[] = [
    {
      label: dictionary.common.all,
      value: "",
      count: Object.values(counts).reduce((sum, n) => sum + n, 0),
      tone: "neutral",
    },
    ...ACTIONABLE.map((state) => ({
      label: dictionary.applicationStatus[state],
      value: state,
      count: counts[state] ?? 0,
      // Anything waiting on a decision is the point of this page, so it reads
      // as the live filter even when it is not the selected one.
      tone: "accent" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <SectionHeading
        title={dictionary.backoffice.queue}
        description={interpolate(dictionary.backoffice.queueCount, { count: total })}
        level={2}
      />

      <nav aria-label={dictionary.backoffice.filterState} className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = (filters.state ?? "") === chip.value;
          return (
            <Link
              key={chip.value || "all"}
              href={chip.value ? `?state=${chip.value}` : "?"}
              aria-current={active ? "true" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--accent-ink)]"
                  : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {chip.label}
              <span
                className={`tabular rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-[var(--accent-ink)] text-white"
                    : chip.tone === "accent" && chip.count > 0
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] font-semibold"
                      : "bg-[var(--surface-muted)] text-[var(--muted)]"
                }`}
              >
                {chip.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--muted)]">{dictionary.backoffice.search}</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--muted)]">{dictionary.backoffice.filterState}</span>
            <select
              name="state"
              defaultValue={filters.state ?? ""}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5"
            >
              <option value="">{dictionary.common.all}</option>
              {APPLICATION_STATES.map((state) => (
                <option key={state} value={state}>
                  {dictionary.applicationStatus[state]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--muted)]">{dictionary.backoffice.filterOutcome}</span>
            <select
              name="outcome"
              defaultValue={filters.outcome ?? ""}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5"
            >
              <option value="">{dictionary.common.all}</option>
              {(["ACCEPT", "REFER", "DECLINE"] as const).map((outcome) => (
                <option key={outcome} value={outcome}>
                  {dictionary.backoffice.outcome[outcome]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-1.5"
          >
            {dictionary.backoffice.filters}
          </button>
        </form>
      </Card>

      {items.length === 0 ? (
        <EmptyState title={dictionary.backoffice.empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th scope="col" className="py-2 pr-3">{dictionary.backoffice.reference}</th>
                <th scope="col" className="py-2 pr-3">{dictionary.backoffice.applicant}</th>
                <th scope="col" className="py-2 pr-3 text-right">{dictionary.backoffice.amount}</th>
                <th scope="col" className="py-2 pr-3">{dictionary.backoffice.state}</th>
                <th scope="col" className="py-2 pr-3">{dictionary.backoffice.filterOutcome}</th>
                <th scope="col" className="py-2">{dictionary.backoffice.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-[var(--border)] ${
                    item.state === "SUBMITTED" ? "bg-[var(--accent-soft)]/50" : ""
                  }`}
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/${locale}/backoffice/applications/${item.id}`}
                      className="tabular underline underline-offset-2"
                    >
                      {item.reference}
                    </Link>
                    {item.slaBreached ? (
                      <Badge tone="danger" className="ml-2">
                        {dictionary.backoffice.slaBreached}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">{item.applicantName}</td>
                  <td className="tabular py-2 pr-3 text-right">
                    {formatMoney(item.amount, typedLocale, "EUR", { showDecimals: false })}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={item.state === "SUBMITTED" ? "accent" : "neutral"}>
                      {dictionary.applicationStatus[item.state]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {item.outcome ? (
                      <Badge tone={OUTCOME_TONE[item.outcome as keyof typeof OUTCOME_TONE]}>
                        {dictionary.backoffice.outcome[item.outcome as keyof typeof OUTCOME_TONE]} ·{" "}
                        {item.score}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tabular py-2 text-xs text-[var(--muted)]">
                    {formatDateTime(item.createdAt, typedLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Below the queue, not beside it: set once and rarely touched, it
          should not compete with the files waiting on a decision. */}
      <Card className="space-y-4 p-5">
        <SectionHeading title={dictionary.backoffice.accountSpaceTitle} level={3} />
        <p className="text-sm leading-relaxed text-[var(--muted)]">{dictionary.backoffice.accountSpaceIntro}</p>
        <AccountSpaceForm
          dictionary={dictionary}
          action={saveAccountSpaceAction.bind(null, locale)}
          details={accountSpace}
        />
      </Card>
    </div>
  );
}
