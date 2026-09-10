"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { LoanPurpose } from "@/domain/application/types";
import { priceLoan } from "@/domain/finance/quote";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import type { Dictionary, Locale } from "@/i18n";
import { Alert, Button, Card, Figure, SectionHeading } from "./ui";

export interface SimulatorLimits {
  minAmount: number;
  maxAmount: number;
  amountStep: number;
  defaultAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  termStep: number;
  defaultTermMonths: number;
  defaultPurpose?: LoanPurpose;
  referenceRate: number;
}

const PURPOSES: LoanPurpose[] = [
  "FREE_USE",
  "VEHICLE",
  "RENOVATION",
  "DEBT_CONSOLIDATION",
  "FURNITURE",
  "EDUCATION",
  "MEDICAL",
  "TRAVEL",
];

/**
 * Turns a wheel over a slider into a step.
 *
 * No browser does this on its own — Chrome ignores the wheel on a range input
 * entirely — so a control that visibly invites dragging looks inert to anyone
 * who tries to scroll it instead. The listener is attached natively rather
 * than through React's `onWheel`, which React registers as passive: calling
 * `preventDefault` there does nothing.
 *
 * At either end of the range the event is left alone, so a page scroll that
 * happens to pass over a slider already at its maximum is not swallowed by it.
 */
function useWheelStep(
  ref: RefObject<HTMLInputElement | null>,
  step: (direction: 1 | -1) => boolean,
): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      if (delta === 0) return;
      if (step(delta > 0 ? -1 : 1)) event.preventDefault();
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [ref, step]);
}

/**
 * The anonymous simulator.
 *
 * It prices with `priceLoan` — the very module the server uses to quote real
 * offers — so the figure a visitor sees while dragging a slider is produced by
 * the same code that will later produce their contract. There is no second,
 * simplified formula living in the front end to drift out of step.
 *
 * It also sends nothing anywhere while the visitor explores. A request is made
 * only when they choose to continue.
 */
export function Simulator({
  locale,
  dictionary,
  limits,
  action,
  ctaLabel,
  footnote,
}: {
  locale: Locale;
  dictionary: Dictionary;
  limits: SimulatorLimits;
  action: (formData: FormData) => void;
  /** Defaults to the marketing call to action; the funnel step overrides it. */
  ctaLabel?: string;
  footnote?: string;
}) {
  const [amount, setAmount] = useState(limits.defaultAmount);
  const [termMonths, setTermMonths] = useState(limits.defaultTermMonths);
  const [purpose, setPurpose] = useState<LoanPurpose>(limits.defaultPurpose ?? "FREE_USE");
  const [showSchedule, setShowSchedule] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const quote = useMemo(
    () =>
      priceLoan({
        netAmount: amount,
        termMonths,
        nominalAnnualRate: limits.referenceRate,
        currency: "EUR",
        drawdownDate: new Date(),
      }),
    [amount, termMonths, limits.referenceRate],
  );

  const amountRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<HTMLInputElement>(null);

  const stepAmount = useCallback(
    (direction: 1 | -1) => {
      const next = Math.min(
        limits.maxAmount,
        Math.max(limits.minAmount, amount + direction * limits.amountStep),
      );
      if (next === amount) return false;
      setAmount(next);
      return true;
    },
    [amount, limits.amountStep, limits.maxAmount, limits.minAmount],
  );

  const stepTerm = useCallback(
    (direction: 1 | -1) => {
      const next = Math.min(
        limits.maxTermMonths,
        Math.max(limits.minTermMonths, termMonths + direction * limits.termStep),
      );
      if (next === termMonths) return false;
      setTermMonths(next);
      return true;
    },
    [termMonths, limits.termStep, limits.maxTermMonths, limits.minTermMonths],
  );

  useWheelStep(amountRef, stepAmount);
  useWheelStep(termRef, stepTerm);

  const t = dictionary.simulator;

  return (
    <Card className="p-5 sm:p-7 space-y-6">
      <SectionHeading title={t.title} level={2} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="sim-amount" className="text-sm font-medium">
                {t.amountLabel}
              </label>
              <output htmlFor="sim-amount" className="tabular text-lg font-semibold">
                {formatMoney(amount, locale, "EUR", { showDecimals: false })}
              </output>
            </div>
            <input
              id="sim-amount"
              ref={amountRef}
              type="range"
              min={limits.minAmount}
              max={limits.maxAmount}
              step={limits.amountStep}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <div className="flex justify-between text-xs text-[var(--muted)] tabular">
              <span>{formatMoney(limits.minAmount, locale, "EUR", { showDecimals: false })}</span>
              <span>{formatMoney(limits.maxAmount, locale, "EUR", { showDecimals: false })}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="sim-term" className="text-sm font-medium">
                {t.termLabel}
              </label>
              {/* A plain span holding one piece of text, not an `output` built
                  from three. The read-out beside this slider once sat at its
                  default while the slider moved underneath it, and those were
                  its two differences from the amount above, which never had
                  the problem. */}
              <span className="tabular text-lg font-semibold">
                {`${formatNumber(termMonths, locale)} ${dictionary.common.months}`}
              </span>
            </div>
            <input
              id="sim-term"
              ref={termRef}
              type="range"
              min={limits.minTermMonths}
              max={limits.maxTermMonths}
              step={limits.termStep}
              value={termMonths}
              onChange={(event) => setTermMonths(Number(event.target.value))}
            />
            <div className="flex justify-between text-xs text-[var(--muted)] tabular">
              <span>{limits.minTermMonths}</span>
              <span>{limits.maxTermMonths}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sim-purpose" className="text-sm font-medium">
              {t.purposeLabel}
            </label>
            <select
              id="sim-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as LoanPurpose)}
              aria-describedby="sim-purpose-hint"
              className="ds-control w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm transition-all duration-200 ease-out"
            >
              {PURPOSES.map((option) => (
                <option key={option} value={option}>
                  {dictionary.purpose[option]}
                </option>
              ))}
            </select>
            <p id="sim-purpose-hint" className="text-xs leading-relaxed text-[var(--muted)]">
              {t.purposeHint}
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-sm font-semibold">{t.resultTitle}</h3>

          {/* The two headline figures get the full card width each, stacked.
              At the large bold size a currency value needs to actually read
              as the answer to "how much", two of them side by side in a
              narrow sidebar collide with each other — full width is the only
              column guaranteed wide enough regardless of locale or amount. */}
          <dl className="grid gap-3">
            <div className="rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--surface)] px-4 py-3">
              <Figure label={t.instalment} value={formatMoney(quote.base.instalment, locale)} emphasis />
            </div>
            <div className="rounded-[var(--radius-sm)] border border-[var(--rate-accent)] bg-[var(--surface)] px-4 py-3">
              <Figure
                label={t.effectiveRate}
                value={formatPercent(quote.effectiveAnnualRate, locale)}
                emphasis
                accent="rate"
              />
            </div>
          </dl>

          <dl className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
            <Figure label={t.nominalRate} value={formatPercent(quote.nominalAnnualRate, locale)} />
            <Figure label={t.totalCost} value={formatMoney(quote.base.totalCreditCost, locale)} />
            <Figure label={t.totalPayable} value={formatMoney(quote.base.totalPayable, locale)} />
            <Figure
              label={t.numberOfInstalments}
              value={formatNumber(quote.base.plan.entries.length, locale)}
            />
            <Figure label={t.firstDueDate} value={formatDate(quote.firstDueDate, locale)} />
            <Figure label={t.lastDueDate} value={formatDate(quote.lastDueDate, locale)} />
          </dl>

          <p className="text-xs leading-relaxed text-[var(--muted)]">{t.disclaimer}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowSchedule((open) => !open)}
              className="text-sm font-medium underline underline-offset-2"
              aria-expanded={showSchedule}
              aria-controls="sim-schedule"
            >
              {showSchedule ? t.hideSchedule : t.showSchedule}
            </button>
            <button
              type="button"
              onClick={() => setShowExplanation((open) => !open)}
              className="text-sm font-medium underline underline-offset-2"
              aria-expanded={showExplanation}
              aria-controls="sim-explain"
            >
              {t.ctaExplain}
            </button>
          </div>
        </div>
      </div>

      {showExplanation ? (
        <div id="sim-explain">
          <Alert tone="info" title={t.explainTitle}>
            <p>{t.explainBody}</p>
          </Alert>
        </div>
      ) : null}

      {showSchedule ? (
        <div id="sim-schedule" className="overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <caption className="sr-only">{t.showSchedule}</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th scope="col" className="py-2 pr-3">{t.scheduleColumns.index}</th>
                <th scope="col" className="py-2 pr-3">{t.scheduleColumns.dueDate}</th>
                <th scope="col" className="py-2 pr-3 text-right">{t.scheduleColumns.payment}</th>
                <th scope="col" className="py-2 pr-3 text-right">{t.scheduleColumns.interest}</th>
                <th scope="col" className="py-2 pr-3 text-right">{t.scheduleColumns.principal}</th>
                <th scope="col" className="py-2 text-right">{t.scheduleColumns.closing}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {quote.base.plan.entries.map((entry) => (
                <tr key={entry.index} className="border-b border-[var(--border)]">
                  <td className="py-1.5 pr-3">{entry.index}</td>
                  <td className="py-1.5 pr-3">{formatDate(entry.dueDate, locale)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMoney(entry.payment, locale)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMoney(entry.interest, locale)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatMoney(entry.principal, locale)}</td>
                  <td className="py-1.5 text-right">{formatMoney(entry.closingBalance, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form action={action} className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5">
        <input type="hidden" name="amount" value={amount} />
        <input type="hidden" name="termMonths" value={termMonths} />
        <input type="hidden" name="purpose" value={purpose} />
        <Button type="submit">{ctaLabel ?? t.ctaConditions}</Button>
        <p className="text-xs text-[var(--muted)]">{footnote ?? dictionary.landing.trustNeutral}</p>
      </form>
    </Card>
  );
}
