import {
  CompareIcon,
  InstantIcon,
  NeutralScaleIcon,
  NoAccountIcon,
  RepaymentFreeIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";

const ICONS = {
  apr: CompareIcon,
  neutral: NeutralScaleIcon,
  noFees: ShieldCheckIcon,
  online: InstantIcon,
  support: NoAccountIcon,
  early: RepaymentFreeIcon,
} as const;

/**
 * The benefits grid.
 *
 * Distinct from the three-step process above it: that section explains what
 * happens, this one explains why it is worth doing here rather than
 * elsewhere — the two questions a comparison-site visitor actually has.
 */
export function Benefits({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.landing.benefits;
  const keys = Object.keys(ICONS) as (keyof typeof ICONS)[];

  return (
    <div className="space-y-10">
      <Reveal>
        <SectionHeading title={t.title} level={2} />
      </Reveal>
      <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((key, index) => {
          const Icon = ICONS[key];
          return (
            <Reveal key={key} as="li" delay={(index % 3) * 80} className="flex gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[var(--shadow-sm)]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display font-semibold">{t.items[key].title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  {t.items[key].body}
                </p>
              </div>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}
