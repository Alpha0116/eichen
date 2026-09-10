import { DocumentUploadIcon, IdCardIcon, NeutralScaleIcon, PayoutIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { Card, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";

const ICONS = {
  identity: IdCardIcon,
  income: DocumentUploadIcon,
  bureau: NeutralScaleIcon,
  bankAccount: PayoutIcon,
} as const;

/** Explains, plainly, what each category of data is for and why it is asked. */
export function DataTrust({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.landing.dataTrust;
  const keys = Object.keys(ICONS) as (keyof typeof ICONS)[];

  return (
    <div className="space-y-10">
      <Reveal>
        <SectionHeading title={t.title} description={t.intro} level={2} />
      </Reveal>
      <ul className="grid gap-5 sm:grid-cols-2">
        {keys.map((key, index) => {
          const Icon = ICONS[key];
          return (
            <Reveal key={key} as="li" delay={(index % 2) * 90}>
              <Card elevation="sm" lift className="flex h-full gap-4 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--info-soft)] text-[var(--info)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display font-semibold">{t.items[key].title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                    {t.items[key].body}
                  </p>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}
