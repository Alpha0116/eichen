import { CalculatorIcon, CompareIcon, PayoutIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";

const ICONS = [CalculatorIcon, CompareIcon, PayoutIcon] as const;
const KEYS = ["wish", "compare", "receive"] as const;

/** The condensed summary of the five-step funnel. */
export function ThreeSteps({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.landing.threeSteps;

  return (
    <div className="space-y-10">
      <Reveal>
        <SectionHeading title={t.title} level={2} />
      </Reveal>

      <ol className="relative grid gap-6 sm:grid-cols-3">
        {/* One continuous rule behind the three markers, rather than an arrow
            glued to each card: the sequence is a line, and drawing it as one
            keeps it aligned however tall the cards grow. */}
        <span
          aria-hidden
          className="absolute left-0 right-0 top-[3.25rem] hidden h-px bg-[var(--border-strong)] sm:block"
        />
        {KEYS.map((key, index) => {
          const Icon = ICONS[index];
          return (
            <Reveal key={key} as="li" delay={index * 110} className="relative">
              <div className="ds-lift h-full space-y-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-md)]">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow-md)]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="tabular font-display text-4xl font-bold text-[var(--border-strong)]">
                    {index + 1}
                  </span>
                </div>
                <h3 className="font-display text-[length:var(--text-h3)] font-semibold">
                  {t.items[key].title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{t.items[key].body}</p>
              </div>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
