import type { Dictionary } from "@/i18n";

/**
 * The wait for the payout, drawn as a bar.
 *
 * It fills to 70% and stops there. The last stretch is not the passage of
 * time, it is an administrator confirming the transfer, and a bar that kept
 * creeping towards the end would be promising something no timer can deliver.
 *
 * The width is computed on the server from the moment the fee settled, not
 * animated from zero in the browser. The page reloads itself every few
 * seconds, and a CSS animation would restart on each of those — the borrower
 * would watch the same first seconds over and over. Derived from a timestamp,
 * it only ever moves forward, and it survives a reload, a new tab and a phone
 * that went to sleep.
 */

/** Where the bar starts, and where it waits. */
const FLOOR = 12;
const CEILING = 70;

/** How long the climb from one to the other takes. */
const RAMP_MS = 4 * 60 * 1000;

export function DisbursementProgress({
  dictionary,
  settled,
  startedAt,
}: {
  dictionary: Dictionary;
  settled: boolean;
  /** When the fee settled: the point the climb is measured from. */
  startedAt: Date | null;
}) {
  const t = dictionary.funnel.processing;
  const steps = [t.steps.fee, t.steps.checks, t.steps.payout];
  const percent = settled ? 100 : progressFrom(startedAt);
  // The fee is banked before this page is ever reached, so the first step is
  // always behind us; the last one only lands when the payout is confirmed.
  const reached = settled ? 3 : 1;

  return (
    <div className="space-y-3">
      <div
        role="progressbar"
        aria-label={t.progressLabel}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={settled ? t.progressDone : t.progressWaiting}
        className="h-2.5 w-full overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)]"
      >
        {/* The width transitions rather than jumping, so a reload that gains a
            percent or two reads as movement instead of a redraw. */}
        <div
          style={{ width: `${percent}%` }}
          className={`h-full rounded-full transition-[width] duration-1000 ease-out ${
            settled ? "bg-[var(--positive)]" : "ds-progress-waiting bg-[var(--accent)]"
          }`}
        />
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((label, index) => {
          const done = index < reached;
          const active = !settled && index === reached;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-xs ${
                done || active ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${
                  done
                    ? "bg-[var(--accent)]"
                    : active
                      ? "ds-progress-pulse bg-[var(--accent)]"
                      : "bg-[var(--border-strong)]"
                }`}
              />
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * How far along the wait is, from the moment the fee settled.
 *
 * Eases out rather than climbing linearly: most of the movement happens in the
 * first minutes, when a borrower is actually watching, and the bar has visibly
 * come to rest by the time it reaches the ceiling.
 */
function progressFrom(startedAt: Date | null): number {
  if (!startedAt) return FLOOR;
  const elapsed = Date.now() - startedAt.getTime();
  if (elapsed <= 0) return FLOOR;
  const fraction = Math.min(1, elapsed / RAMP_MS);
  const eased = 1 - (1 - fraction) ** 2;
  return Math.round(FLOOR + (CEILING - FLOOR) * eased);
}
