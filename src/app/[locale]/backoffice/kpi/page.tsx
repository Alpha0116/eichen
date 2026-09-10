import { Card, Figure, SectionHeading } from "@/components/ui";
import { getDictionary, type Locale } from "@/i18n";
import { formatNumber, formatPercent } from "@/i18n/format";
import { requireStaff } from "@/server/access";
import { funnelKpis } from "@/server/services/kpi";

export default async function KpiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireStaff(locale);

  const kpis = await funnelKpis();
  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.backoffice.kpi;

  const counts: { label: string; value: number }[] = [
    { label: t.simulations, value: kpis.simulations },
    { label: t.eligibilityRequests, value: kpis.eligibilityRequests },
    { label: t.submitted, value: kpis.submitted },
    { label: t.approved, value: kpis.approved },
    { label: t.disbursed, value: kpis.disbursed },
    { label: t.integrationFailures, value: kpis.integrationFailures },
  ];

  const rates: { label: string; value: number }[] = [
    { label: t.manualReviewRate, value: kpis.manualReviewRate },
    { label: t.documentRejectRate, value: kpis.documentRejectRate },
    { label: t.bankCheckFailureRate, value: kpis.bankCheckFailureRate },
  ];

  const maxState = Math.max(1, ...kpis.byState.map((row) => row.count));

  return (
    <div className="space-y-6">
      <SectionHeading title={dictionary.backoffice.kpiTitle} level={2} />

      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {counts.map((item) => (
            <Figure
              key={item.label}
              label={item.label}
              value={formatNumber(item.value, typedLocale)}
              emphasis
            />
          ))}
        </dl>
      </Card>

      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {rates.map((item) => (
            <Figure key={item.label} label={item.label} value={formatPercent(item.value, typedLocale, 1)} />
          ))}
          <Figure
            label={t.medianDecisionMinutes}
            value={
              kpis.medianDecisionMinutes === null
                ? "—"
                : formatNumber(kpis.medianDecisionMinutes, typedLocale, 1)
            }
          />
        </dl>
      </Card>

      <Card className="space-y-3 p-5">
        <SectionHeading title={dictionary.backoffice.filterState} level={3} />
        {/* A plain bar per state: where applications actually stop is the one
            thing this page exists to make visible. */}
        <ul className="space-y-2">
          {kpis.byState.map((row) => (
            <li key={row.state} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
              <span className="truncate">
                {dictionary.applicationStatus[row.state as keyof typeof dictionary.applicationStatus]}
              </span>
              <span className="h-2 rounded-full bg-[var(--surface-muted)]">
                <span
                  className="block h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${(row.count / maxState) * 100}%` }}
                />
              </span>
              <span className="tabular text-right">{formatNumber(row.count, typedLocale)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
