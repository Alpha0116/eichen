import Image from "next/image";
import { StarIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import type { Dictionary } from "@/i18n";

const KEYS = ["r1", "r2", "r3", "r4", "r5"] as const;

const AVATARS: Record<(typeof KEYS)[number], string> = {
  r1: "/avatar-1.webp",
  r2: "/avatar-2.webp",
  r3: "/avatar-3.webp",
  r4: "/avatar-4.webp",
  r5: "/avatar-5.webp",
};

const RATINGS: Record<(typeof KEYS)[number], number> = { r1: 5, r2: 5, r3: 4, r4: 5, r5: 5 };

function Stars({ count, label }: { count: number; label: string }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((position) => (
        <StarIcon
          key={position}
          aria-hidden
          className={`h-4 w-4 ${position <= count ? "text-[var(--accent)]" : "text-[var(--border-strong)]"}`}
        />
      ))}
    </span>
  );
}

function ReviewCard({
  dictionary,
  reviewKey,
}: {
  dictionary: Dictionary;
  reviewKey: (typeof KEYS)[number];
}) {
  const review = dictionary.landing.reviews.items[reviewKey];
  const rating = RATINGS[reviewKey];

  return (
    <figure className="flex w-[19rem] shrink-0 flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] sm:w-[23rem]">
      <Stars count={rating} label={`${rating}/5`} />
      <blockquote className="text-[0.95rem] leading-relaxed text-[var(--foreground)]">
        “{review.quote}”
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 border-t border-[var(--border)] pt-4">
        <Image
          src={AVATARS[reviewKey]}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 rounded-full object-cover"
        />
        <span className="text-sm">
          <span className="block font-semibold">{review.name}</span>
          <span className="block text-xs text-[var(--muted)]">
            {review.city} · {review.purpose}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * The review strip.
 *
 * Two identical runs of the same cards inside a track translated by exactly
 * half its width: the loop closes on itself with no visible seam, and the
 * whole thing is CSS — no scroll listener, no timer, nothing to clean up.
 * The second run is hidden from assistive technology so a screen reader is not
 * read the same five reviews twice, and hovering or tabbing into the strip
 * pauses it so a sentence can actually be finished.
 */
export function Reviews({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.landing.reviews;
  const average = (
    KEYS.reduce((sum, key) => sum + RATINGS[key], 0) / KEYS.length
  ).toFixed(1);

  return (
    <div className="space-y-10">
      <div className="ds-container">
        <Reveal className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="font-display text-[1.5rem] font-semibold tracking-tight sm:text-[length:var(--text-h2)]">
              {t.title}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{t.intro}</p>
          </div>
          <div className="flex items-center gap-3 rounded-[var(--radius-full)] border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-5 shadow-[var(--shadow-sm)]">
            <Stars count={5} label={`${average}/5`} />
            <span className="text-sm">
              <span className="tabular font-semibold">{average}</span>
              <span className="text-[var(--muted)]"> · {t.basedOn}</span>
            </span>
          </div>
        </Reveal>
      </div>

      <div
        className="ds-marquee-viewport relative overflow-hidden"
        style={{
          // Fades the strip into the page ground at both edges, so cards leave
          // the viewport instead of being visibly clipped by it.
          maskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        }}
      >
        <div className="ds-marquee flex w-max gap-5" style={{ ["--marquee-duration" as string]: "64s" }}>
          {KEYS.map((key) => (
            <ReviewCard key={key} dictionary={dictionary} reviewKey={key} />
          ))}
          <div aria-hidden className="flex gap-5">
            {KEYS.map((key) => (
              <ReviewCard key={`dup-${key}`} dictionary={dictionary} reviewKey={key} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
