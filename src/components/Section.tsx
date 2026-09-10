import type { ReactNode } from "react";

/**
 * A full-bleed band with its own ground colour.
 *
 * The page is a stack of these. Alternating the ground is what gives a long
 * marketing page its rhythm: on one continuous white sheet every section reads
 * as the same section, however different its content is.
 *
 * `primary` flips the whole token set to the dark palette through `.on-dark`,
 * so cards, headings and muted text inside adapt without every child needing a
 * variant of its own.
 */
export type SectionTone = "surface" | "muted" | "primary" | "accent";

const TONE: Record<SectionTone, string> = {
  surface: "bg-[var(--surface)]",
  muted: "bg-[var(--surface-muted)]",
  primary: "on-dark bg-[var(--primary)]",
  accent: "bg-[var(--accent-soft)]",
};

export function Section({
  children,
  tone = "surface",
  id,
  className = "",
  /** Drops the inner container, for sections that genuinely go edge to edge. */
  bleed = false,
}: {
  children: ReactNode;
  tone?: SectionTone;
  id?: string;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-20 ${TONE[tone]} ${bleed ? "" : "py-16 sm:py-24"} ${className}`}
    >
      {bleed ? children : <div className="ds-container">{children}</div>}
    </section>
  );
}
