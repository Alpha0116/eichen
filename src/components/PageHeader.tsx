import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The band that opens an interior page.
 *
 * Every page below the home page used to start as a narrow column of white on
 * a white ground, which gave the reader nothing to orient against. This gives
 * each one a full-bleed opening on the brand navy — optionally over a
 * photograph — so a page announces itself before its content starts.
 *
 * It carries `.on-dark`, so anything placed in `aside` or `children` picks up
 * the inverted token set rather than needing its own dark variant.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  image,
  aside,
  children,
}: {
  title: string;
  description?: string;
  /** Small label above the title: a reference number, a section name. */
  eyebrow?: ReactNode;
  /** Path under /public. Omitted, the band is a flat navy. */
  image?: string;
  /** Right-hand slot: a status badge, a figure, an action. */
  aside?: ReactNode;
  /** Rendered under the description, inside the band. */
  children?: ReactNode;
}) {
  return (
    <header className="on-dark relative isolate overflow-hidden bg-[var(--primary)]">
      {image ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-center"
          />
          {/* The same two-layer scrim the home page uses: one across the copy
              column, one up from the bottom edge, so white text clears 4.5:1
              wherever the photograph happens to be bright. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(to right, rgb(13 0 93 / 0.94) 0%, rgb(13 0 93 / 0.86) 45%, rgb(13 0 93 / 0.6) 100%)",
            }}
          />
        </>
      ) : (
        // A flat band still gets a little depth, or it reads as a printed
        // header rather than part of the interface.
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(120% 140% at 12% 0%, rgb(255 117 31 / 0.28) 0%, transparent 55%)",
          }}
        />
      )}

      <div className="ds-container py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 space-y-2">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="font-display text-[1.875rem] font-bold leading-tight tracking-tight text-white sm:text-[2.5rem]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl leading-relaxed text-white/80">{description}</p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </header>
  );
}
