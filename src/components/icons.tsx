import type { SVGProps } from "react";

/**
 * A small, hand-drawn icon set.
 *
 * Every icon shares one stroke width, one viewBox and `currentColor`, so a
 * component can recolour or resize them with ordinary text/colour utilities
 * instead of prop-drilling a colour into each SVG. There is no icon library
 * dependency: the set the product actually needs is small enough that owning
 * the dozen paths outright is simpler than pulling in a package for them.
 */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: React.ReactNode) {
  const { className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CalculatorIcon = (props: IconProps) =>
  base(
    props,
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2.2" />
      <path d="M7.5 6.5h9M7.5 11h1.6M11.2 11h1.6M14.9 11h1.6M7.5 14.6h1.6M11.2 14.6h1.6M14.9 14.6v4M7.5 18.2h1.6M11.2 18.2h1.6" />
    </>,
  );

export const ShieldCheckIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 2.6 4.5 5.4v6.1c0 5 3.2 8.3 7.5 9.9 4.3-1.6 7.5-4.9 7.5-9.9V5.4L12 2.6Z" />
      <path d="m8.7 12.1 2.3 2.3 4.3-4.6" />
    </>,
  );

export const CompareIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M7 3v14a2 2 0 0 0 2 2h1" />
      <path d="M17 21V7a2 2 0 0 0-2-2h-1" />
      <path d="m4 6 3-3 3 3M20 18l-3 3-3-3" />
    </>,
  );

export const DocumentUploadIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M6 3.6h8.2L19 8.4V19a1.4 1.4 0 0 1-1.4 1.4H6A1.4 1.4 0 0 1 4.6 19V5A1.4 1.4 0 0 1 6 3.6Z" />
      <path d="M14 3.6V8h4.4" />
      <path d="M12 17v-6M9.3 13.5 12 10.8l2.7 2.7" />
    </>,
  );

export const IdCardIcon = (props: IconProps) =>
  base(
    props,
    <>
      <rect x="2.6" y="5" width="18.8" height="14" rx="2" />
      <circle cx="8.2" cy="10.6" r="1.9" />
      <path d="M5.4 16.2c.5-1.7 1.9-2.6 2.8-2.6s2.3.9 2.8 2.6M14.2 9.4h4.4M14.2 12.4h4.4M14.2 15.4h2.8" />
    </>,
  );

export const PayoutIcon = (props: IconProps) =>
  base(
    props,
    <>
      <rect x="2.6" y="6.4" width="18.8" height="12.2" rx="2" />
      <circle cx="12" cy="12.5" r="2.6" />
      <path d="M2.6 9.6h18.8M6 15.4h.01M18 9.6h.01" />
    </>,
  );

export const NoAccountIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" />
      <path d="M4 4.5 19.5 20" strokeOpacity={0.001} />
    </>,
  );

export const NeutralScaleIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 3v18M7 8H3.5l2 5a2.5 2.5 0 0 0 5 0l-2-5H12" />
      <path d="M12 8h4.5l-2 5a2.5 2.5 0 0 1-5 0l2-5H12" />
      <path d="M7 21h10" />
    </>,
  );

export const InstantIcon = (props: IconProps) =>
  base(props, <path d="M12.8 2.5 4 14h6l-1 7.5L20 10h-6l-1.2-7.5Z" />);

export const RepaymentFreeIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5" />
    </>,
  );

export const CoBorrowerIcon = (props: IconProps) =>
  base(
    props,
    <>
      <circle cx="8.3" cy="8" r="2.7" />
      <circle cx="16.2" cy="8" r="2.7" />
      <path d="M3 19c0-2.9 2.4-5 5.3-5 1 0 1.9.25 2.7.7M13 14.7c.8-.45 1.7-.7 2.7-.7 2.9 0 5.3 2.1 5.3 5" />
    </>,
  );

export const ChevronRightIcon = (props: IconProps) => base(props, <path d="m9 5 7 7-7 7" />);

export const CheckIcon = (props: IconProps) => base(props, <path d="M5 12.5 9.5 17 19 7" />);

// --- Loan-purpose icons -----------------------------------------------------

export const SparkleIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 3.5c.6 3 2 4.4 5 5-3 .6-4.4 2-5 5-.6-3-2-4.4-5-5 3-.6 4.4-2 5-5Z" />
      <path d="M19 15.5c.3 1.4.9 2 2.3 2.3-1.4.3-2 .9-2.3 2.3-.3-1.4-.9-2-2.3-2.3 1.4-.3 2-.9 2.3-2.3Z" />
    </>,
  );

export const CarIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M4.5 15.5 6 10.2a2 2 0 0 1 1.9-1.4h8.2a2 2 0 0 1 1.9 1.4l1.5 5.3" />
      <rect x="3" y="14.5" width="18" height="5" rx="1.6" />
      <circle cx="7.5" cy="19.5" r="1.6" />
      <circle cx="16.5" cy="19.5" r="1.6" />
    </>,
  );

export const HomeIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" />
      <path d="M10 20.5v-5h4v5" />
    </>,
  );

export const DebtConsolidationIcon = (props: IconProps) =>
  base(
    props,
    <>
      <rect x="3" y="4" width="13" height="9" rx="1.8" />
      <rect x="8" y="11" width="13" height="9" rx="1.8" />
      <path d="M6.5 8h6M13 16h6" />
    </>,
  );

export const FurnitureIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
      <path d="M4 12h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4Z" />
      <path d="M5 17v2.5M19 17v2.5" />
    </>,
  );

export const GraduationCapIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" />
      <path d="M6.5 11v4.3c0 1.5 2.5 2.7 5.5 2.7s5.5-1.2 5.5-2.7V11" />
    </>,
  );

export const HeartPulseIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M12 20.5S3.5 15.4 3.5 9.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 2.2c0 6-8.5 11.1-8.5 11.1Z" />
      <path d="m6.5 12 2-2.5 1.6 3 1.6-4.5L13.2 12H17" />
    </>,
  );

export const PlaneIcon = (props: IconProps) =>
  base(
    props,
    <>
      <path d="M3 13.2 20 6.5c.9-.35 1.7.5 1.3 1.4L13.5 21l-1.9-6.6L5 12.5" />
      <path d="M11.6 14.4 5 12.5l1-2.6" />
    </>,
  );

/**
 * WhatsApp glyph, drawn as a filled path rather than pulled from an icon font
 * so it renders with no network request and inherits `currentColor`.
 */
export function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.84c2.15 0 4.17.84 5.69 2.36a8.02 8.02 0 0 1 2.36 5.71c0 4.45-3.62 8.07-8.07 8.07a8.2 8.2 0 0 1-4.11-1.12l-.29-.17-3.05.8.81-2.97-.19-.31a8.02 8.02 0 0 1-1.25-4.3c0-4.45 3.62-8.07 8.1-8.07Zm-2.5 4.3c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.43 1.03 2.6c.13.17 1.76 2.79 4.33 3.8.6.24 1.07.38 1.44.49.6.19 1.15.16 1.59.1.48-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.1-.23-.16-.48-.29-.25-.12-1.49-.73-1.72-.82-.23-.08-.4-.12-.57.13-.17.25-.65.82-.8.99-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.48-.4-.42-.55-.43h-.47Z" />
    </svg>
  );
}

/** Envelope, for the email contact link. */
export function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className={className}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 8.4 5.6a1.5 1.5 0 0 0 1.2 0L21 7" strokeLinecap="round" />
    </svg>
  );
}

/** Filled star, for a rating row. */
export function StarIcon({ className = "", ...rest }: { className?: string } & Record<string, unknown>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...rest}>
      <path d="m12 2.6 2.9 5.88 6.5.95-4.7 4.58 1.11 6.46L12 17.42l-5.81 3.05 1.11-6.46-4.7-4.58 6.5-.95L12 2.6Z" />
    </svg>
  );
}
