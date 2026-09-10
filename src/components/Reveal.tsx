"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Reveals its children as they scroll into view.
 *
 * An IntersectionObserver rather than a scroll listener: the browser decides
 * when the element crosses the threshold, so there is no work on every frame
 * and nothing to throttle.
 *
 * Three things keep this from breaking the page:
 *  - the hidden state lives under `[data-js]` in CSS, set by an inline script
 *    in the layout, so with scripting off the content is simply visible;
 *  - `prefers-reduced-motion` disables the transform in CSS, not here, so the
 *    preference wins even if this component mounts;
 *  - once revealed, the observer disconnects — an element does not re-hide when
 *    the reader scrolls back up, which is disorienting rather than delightful.
 */
export function Reveal({
  children,
  as: Tag = "div" as ElementType,
  variant = "up",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  /** "up" slides in from below, "scale" grows from slightly small. */
  variant?: "up" | "scale";
  /** Milliseconds, for staggering a row of cards. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already on screen at mount — a hero card, or a page restored mid-scroll.
    // Revealing it immediately avoids a card that stays blank until the reader
    // scrolls, which would look like a broken image.
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setRevealed(true);
          observer.disconnect();
        }
      },
      // A negative bottom margin holds the reveal back until the element is
      // properly in the viewport rather than one pixel past its edge.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      data-revealed={revealed ? "" : undefined}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
