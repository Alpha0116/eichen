import { Badge, Card, SectionHeading } from "@/components/ui";
import { getDictionary, type Locale } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import { requireStaff } from "@/server/access";
import { PRODUCT } from "@/server/config";
import { listRuleSets, publishedRuleSet } from "@/server/services/rules";
import { publishRuleSetAction } from "../actions";
import { RuleSetEditor } from "./RuleSetEditor";

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const agent = await requireStaff(locale);

  const [records, current] = await Promise.all([
    listRuleSets(),
    publishedRuleSet(PRODUCT.country),
  ]);

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.backoffice;
  const publish = publishRuleSetAction.bind(null, locale);
  const canPublish = agent.role === "ADMIN" || agent.role === "RISK";

  // The next version is seeded from the one in force, so an edit is a diff
  // against live behaviour rather than a blank page.
  const seed = JSON.stringify(current, null, 2);

  return (
    <div className="space-y-6">
      <SectionHeading title={t.rulesTitle} description={t.rulesIntro} level={2} />

      <Card className="p-5">
        <ul className="space-y-2 text-sm">
          {records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <code className="text-xs">{record.key}</code> v{record.version} · {record.country}
                {record.note ? (
                  <span className="ml-2 text-[var(--muted)]">{record.note}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-2">
                <Badge
                  tone={
                    record.status === "PUBLISHED"
                      ? "positive"
                      : record.status === "ARCHIVED"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {t.ruleSetStatus[record.status as keyof typeof t.ruleSetStatus]}
                </Badge>
                <span className="tabular text-xs text-[var(--muted)]">
                  {record.publishedAt ? formatDateTime(record.publishedAt, typedLocale) : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {canPublish ? (
        <Card className="p-5">
          <RuleSetEditor dictionary={dictionary} action={publish} initialPayload={seed} />
        </Card>
      ) : (
        <Card className="p-5">
          <pre className="overflow-x-auto text-xs">{seed}</pre>
        </Card>
      )}
    </div>
  );
}
