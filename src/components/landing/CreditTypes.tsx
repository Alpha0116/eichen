import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionHeading } from "@/components/ui";
import type { LoanPurpose } from "@/domain/application/types";
import type { Dictionary, Locale } from "@/i18n";

/**
 * One photograph per purpose. A grid of eight identical icon tiles reads as a
 * list of words; a photograph is what makes "Fahrzeug" mean a car rather than
 * a category name.
 */
const IMAGES: Record<LoanPurpose, string> = {
  FREE_USE: "/purpose-freeuse.webp",
  VEHICLE: "/purpose-vehicle.webp",
  RENOVATION: "/purpose-renovation.webp",
  DEBT_CONSOLIDATION: "/purpose-consolidation.webp",
  FURNITURE: "/purpose-furniture.webp",
  EDUCATION: "/purpose-education.webp",
  MEDICAL: "/purpose-medical.webp",
  TRAVEL: "/purpose-travel.webp",
};

const PURPOSES = Object.keys(IMAGES) as LoanPurpose[];

export function CreditTypes({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const t = dictionary.landing.creditTypes;

  return (
    <div className="space-y-10">
      <Reveal>
        <SectionHeading title={t.title} description={t.intro} level={2} />
      </Reveal>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PURPOSES.map((purpose, index) => (
          <Reveal
            key={purpose}
            as="li"
            variant="up"
            // Staggered by column rather than by index, so a row appears as a
            // row instead of sweeping across four separate beats.
            delay={(index % 4) * 70}
          >
            <Link
              href={`/${locale}/register`}
              className="ds-lift group block h-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
            >
              <span className="relative block aspect-[3/2] overflow-hidden">
                <Image
                  src={IMAGES[purpose]}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="absolute bottom-3 left-4 font-display text-lg font-semibold text-white">
                  {dictionary.purpose[purpose]}
                </span>
              </span>
              <span className="block p-5 text-sm leading-relaxed text-[var(--muted)]">
                {t.descriptions[purpose]}
              </span>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
