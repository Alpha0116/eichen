import { Reveal } from "@/components/Reveal";
import { Card, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";

const KEYS = ["conditions", "binding", "declined", "account", "earlyRepayment", "dataSecurity"] as const;

/**
 * Native <details>/<summary> rather than a client-side accordion: it works
 * without JavaScript, is keyboard- and screen-reader-accessible for free, and
 * a set of six short answers does not need anything more elaborate.
 */
export function Faq({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.landing.faq;

  return (
    <div className="space-y-10">
      <Reveal>
        <SectionHeading title={t.title} level={2} />
      </Reveal>
      <Reveal variant="scale">
        <Card elevation="md" className="divide-y divide-[var(--border)] p-2">
          {KEYS.map((key, index) => (
            // The first question starts open — an FAQ that shows zero answers
            // until clicked reads as empty at a glance.
            <details key={key} className="group p-4" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none">
                {t.items[key].question}
                <span aria-hidden className="shrink-0 text-xl leading-none text-[var(--accent)]">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {t.items[key].answer}
              </p>
            </details>
          ))}
        </Card>
      </Reveal>
    </div>
  );
}
