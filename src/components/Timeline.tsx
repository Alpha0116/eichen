import { Badge } from "./ui";
import type { TimelineEntry } from "@/server/audit";
import type { Locale } from "@/i18n";
import { formatDateTime } from "@/i18n/format";

const ACTOR_TONE = { CUSTOMER: "info", AGENT: "accent", SYSTEM: "neutral" } as const;

/**
 * The application's history, straight from the audit trail.
 *
 * Actions are shown as their stable codes rather than prose: the trail is a
 * record, and translating it into a friendly sentence would put a layer of
 * interpretation between an auditor and what actually happened.
 */
export function Timeline({
  entries,
  locale,
  emptyLabel,
}: {
  entries: TimelineEntry[];
  locale: Locale;
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.sequence} className="flex gap-3">
          <span className="tabular mt-0.5 w-6 shrink-0 text-right text-xs text-[var(--muted)]">
            {entry.sequence}
          </span>
          <div className="min-w-0 flex-1 border-l border-[var(--border)] pb-3 pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-sm font-medium">{entry.action}</code>
              <Badge tone={ACTOR_TONE[entry.actorType as keyof typeof ACTOR_TONE] ?? "neutral"}>
                {entry.actorType}
              </Badge>
              <span className="tabular text-xs text-[var(--muted)]">
                {formatDateTime(entry.occurredAt, locale)}
              </span>
            </div>
            {Object.keys(entry.payload).length > 0 ? (
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--muted)]">
                {Object.entries(entry.payload).map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <dt>{key}:</dt>
                    <dd className="tabular font-medium">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
