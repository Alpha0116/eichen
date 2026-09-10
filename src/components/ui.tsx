import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/**
 * Shared presentation primitives.
 *
 * All server components: none of them holds state. Interactive widgets live in
 * their own "use client" files, which keeps the funnel's pages renderable — and
 * therefore usable — before any JavaScript arrives.
 */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

// Pill buttons and a 0.2s ease transition, per ressources/design-system.md § 5.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-full)] font-medium transition-all duration-200 ease-out disabled:opacity-55 disabled:cursor-not-allowed";

// 12px/28px is the document's primary-button padding; `sm` is the same shape
// at the scale the header and inline actions need.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "px-7 py-3 text-[0.95rem]",
  sm: "px-4 py-1.5 text-sm",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Navy on orange, not white on orange: white would fail contrast. The
  // document's hover rule — darker fill plus shadow-md — applies to both
  // filled variants.
  primary:
    "bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] hover:shadow-[var(--shadow-md)]",
  secondary:
    "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:shadow-[var(--shadow-sm)]",
  ghost: "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] hover:opacity-90",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

type Elevation = "flat" | "sm" | "md" | "lg";

const ELEVATION: Record<Elevation, string> = {
  flat: "",
  sm: "shadow-[var(--shadow-sm)]",
  md: "shadow-[var(--shadow-md)]",
  lg: "shadow-[var(--shadow-lg)]",
};

/**
 * The base surface. `elevation` defaults to a soft shadow rather than none:
 * a flat, bordered-only card is what makes an interface read as an admin tool
 * instead of a product — reserve `flat` for places that sit inside another
 * card, where a second shadow would just look muddy.
 */
export function Card({
  children,
  className = "",
  as: Tag = "div",
  id,
  elevation = "sm",
  lift = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  /** Anchor target, for a card a nav link scrolls to. */
  id?: string;
  elevation?: Elevation;
  /** Hover lift from the document's product-card spec. Only for cards that
      are themselves a link or a choice — a static panel that moves under the
      cursor promises an interaction it does not have. */
  lift?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Tag
      id={id}
      style={style}
      className={`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] ${ELEVATION[elevation]} ${lift ? "ds-lift" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({
  title,
  description,
  level = 2,
}: {
  title: string;
  description?: string;
  level?: 1 | 2 | 3;
}) {
  const Tag = (["h1", "h2", "h3"] as const)[level - 1];
  // The document's h1/h2/h3 steps (40/28/20px), taken down one notch on
  // narrow screens where 40px would wrap a German compound heading to three
  // lines before the eye reaches the verb.
  const size =
    level === 1
      ? "text-[1.875rem] sm:text-[length:var(--text-h1)] font-bold"
      : level === 2
        ? "text-[1.5rem] sm:text-[length:var(--text-h2)] font-semibold"
        : "text-[length:var(--text-h3)] font-semibold";
  return (
    <div className="space-y-1.5">
      <Tag className={`${size} tracking-tight`}>{title}</Tag>
      {description ? (
        <p className="text-sm leading-relaxed text-[var(--muted)] max-w-2xl">{description}</p>
      ) : null}
    </div>
  );
}

type Tone = "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--muted)] border-[var(--border)]",
  positive: "bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]",
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]",
  accent: "bg-[var(--notice-bg)] text-[var(--notice-fg)] border-[var(--accent)]",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const OUTLINE_BORDER: Record<Tone, string> = {
  neutral: "border-l-[var(--border-strong)]",
  positive: "border-l-[var(--positive)]",
  warning: "border-l-[var(--warning)]",
  danger: "border-l-[var(--danger)]",
  info: "border-l-[var(--info)]",
  accent: "border-l-[var(--accent)]",
};

/**
 * `variant="filled"` (default) is for a genuine severity cue — a validation
 * error, a locked account, a decision outcome — where the tone's colour block
 * IS the message. `variant="outline"` is for a calm, always-on notice (a
 * standing disclosure, a "here's what we don't promise" statement): white
 * background, a coloured left rule, so it reads as a permanent fixture of the
 * page rather than a status alert competing for the same attention.
 */
export function Alert({
  tone = "info",
  title,
  children,
  variant = "filled",
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  variant?: "filled" | "outline";
}) {
  if (variant === "outline") {
    return (
      <div
        className={`rounded-[var(--radius-sm)] border border-[var(--border)] border-l-4 bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-sm)] ${OUTLINE_BORDER[tone]}`}
      >
        {title ? <p className="font-semibold mb-1">{title}</p> : null}
        <div className="text-[var(--muted)] [&_p+p]:mt-2">{children}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-[var(--radius-sm)] border px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}>
      {title ? <p className="font-semibold mb-1">{title}</p> : null}
      <div className="[&_p+p]:mt-2">{children}</div>
    </div>
  );
}

/**
 * A labelled figure. `emphasis` marks the number a borrower compares offers on,
 * so the effective annual rate and the monthly instalment never read as small
 * print next to a larger, less relevant figure.
 */
/**
 * `emphasis` is for the one or two figures a page is actually about — the
 * instalment, the effective rate. Bumped well past the secondary figures
 * rather than a notch above them, so the eye lands there first the way it
 * does on a comparison site, not on a form field.
 */
const EMPHASIS_COLOUR = {
  amount: "text-[var(--figure-emphasis)]",
  // A second accent reserved for a rate/percentage figure, so it reads as a
  // different kind of number from an amount at a glance rather than by
  // reading the label — the pattern German rate comparisons use.
  rate: "text-[var(--rate-accent)]",
} as const;

export function Figure({
  label,
  value,
  hint,
  emphasis = false,
  accent = "amount",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  emphasis?: boolean;
  accent?: keyof typeof EMPHASIS_COLOUR;
}) {
  return (
    // A grid row stretches every Figure in it to the height of its tallest
    // sibling. Anchoring the value to the bottom of that stretched box (via
    // mt-auto on a flex column) keeps every value in the row on one shared
    // line however many lines its own label wraps to — a German compound
    // label like "Effektiver Jahreszins p. a." can run to three lines in a
    // narrow column, and a fixed height reservation guessed wrong would
    // either crowd the value against the label or, worse, still overlap it.
    <div className="flex h-full flex-col">
      <dt className="text-xs uppercase leading-tight tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <div className="mt-auto pt-1.5">
        <dd
          className={`tabular ${emphasis ? `text-[2rem] font-bold leading-none ${EMPHASIS_COLOUR[accent]}` : "text-base font-medium"}`}
        >
          {value}
        </dd>
        {hint ? <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

export function KeyValue({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-[var(--border)]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-sm text-[var(--muted)]">{row.label}</dt>
          <dd className="tabular text-sm font-medium text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalLabel,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[length:var(--text-small)] font-medium">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-[var(--danger)]">
            *
          </span>
        ) : optionalLabel ? (
          <span className="ml-1.5 font-normal text-xs text-[var(--muted)]">({optionalLabel})</span>
        ) : null}
      </label>
      {/* aria-describedby is wired by the caller through these ids. */}
      <div data-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}>{children}</div>
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// § 5, "Champs de formulaire": 8px radius, 1px border, and a focus state that
// is the brand border plus a tinted ring rather than the global outline.
const CONTROL =
  "ds-control w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-all duration-200 ease-out";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${CONTROL} ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${CONTROL} ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${CONTROL} ${className}`} />;
}

export function Checkbox({
  id,
  name,
  defaultChecked,
  required,
  children,
}: {
  id: string;
  name: string;
  defaultChecked?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <input
        type="checkbox"
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <label htmlFor={id} className="text-sm leading-relaxed">
        {children}
      </label>
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)] border border-[var(--border)]"
    >
      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {body ? <p className="mt-1 text-sm text-[var(--muted)]">{body}</p> : null}
    </div>
  );
}
