import { MailIcon, WhatsAppIcon } from "./icons";
import { mailtoLink, whatsappLink } from "@/server/config";
import type { Dictionary } from "@/i18n";

/**
 * WhatsApp and email, as two links the visitor's own device resolves.
 *
 * Nothing about the conversation passes through this application: `wa.me` and
 * `mailto:` hand the message straight to whatever the person already uses. The
 * WhatsApp link is opened in a new tab because it is an external application —
 * a borrower halfway through a form must not lose the form to ask a question
 * about it.
 */
export function ContactButtons({
  dictionary,
  reference,
  className = "",
  size = "md",
}: {
  dictionary: Dictionary;
  /** Quoted in the prefilled message, so support knows which file is meant. */
  reference?: string;
  className?: string;
  size?: "md" | "sm";
}) {
  const t = dictionary.contact;
  const subject = reference ? `${t.subject} ${reference}` : t.subject;
  const padding = size === "sm" ? "px-4 py-1.5 text-sm" : "px-7 py-3 text-[0.95rem]";
  const base = `inline-flex items-center justify-center gap-2 rounded-[var(--radius-full)] font-medium transition-all duration-200 ease-out ${padding}`;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={whatsappLink(subject)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} bg-[#25D366] text-[#08300f] hover:brightness-95 hover:shadow-[var(--shadow-md)]`}
      >
        <WhatsAppIcon className="h-4 w-4" />
        {t.whatsapp}
      </a>
      <a
        href={mailtoLink(subject)}
        className={`${base} border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] hover:shadow-[var(--shadow-sm)]`}
      >
        <MailIcon className="h-4 w-4" />
        {t.email}
      </a>
    </div>
  );
}
