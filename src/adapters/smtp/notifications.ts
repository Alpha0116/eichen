import { createTransport, type Transporter } from "nodemailer";
import { assertSendable } from "../notificationGuards";
import type { NotificationPort, ProviderCallMeta, SentMessage } from "../ports";
import { getDictionary, interpolate, toLocale, type Locale } from "../../i18n";

export interface SmtpSettings {
  host: string;
  port: number;
  /** Implicit TLS on 465; STARTTLS is negotiated on 587 and 25. */
  secure: boolean;
  user: string | null;
  password: string | null;
  /** RFC 5322 From header, e.g. `Eichen <no-reply@eichen-kredit.com>`. */
  from: string;
}

/**
 * Reads SMTP settings from the environment, or returns null when they are
 * absent or incomplete — which is what keeps the simulated provider the
 * default in development and in tests.
 */
export function smtpSettingsFromEnv(): SmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const user = process.env.SMTP_USER?.trim() || null;
  const password = process.env.SMTP_PASSWORD || null;

  // A half-filled configuration counts as no configuration. Credentials that
  // authenticate against nothing mean every message is attempted, rejected and
  // recorded as FAILED — worse than the outbox, which at least keeps the
  // messages somewhere they can be read. Every hosted relay wants both, so a
  // host on its own is a configuration somebody started and did not finish.
  if (!user || !password) {
    console.warn(
      `[smtp] SMTP_HOST is set but ${!user ? "SMTP_USER" : "SMTP_PASSWORD"} is missing` +
        " — notifications stay in the in-memory outbox.",
    );
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    // Port 465 is implicit TLS; anything else starts in the clear and upgrades.
    // `SMTP_SECURE` overrides for the rare server that disagrees.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user,
    password,
    from: process.env.SMTP_FROM?.trim() || `Eichen <${user}>`,
  };
}

interface Rendered {
  subject: string;
  body: string;
}

/**
 * Resolves a template key against the dictionary of the recipient's language.
 *
 * Wording lives in `src/i18n/dictionaries`, the same place the interface reads
 * from, so a message can be reviewed and translated without touching code —
 * and a borrower is written to in the language their file was opened in.
 */
function render(templateKey: string, locale: Locale, variables: Record<string, string>): Rendered | null {
  const dictionary = getDictionary(locale);
  const templates = dictionary.notification as unknown as Record<
    string,
    { subject: string; body: string } | undefined
  >;
  const template = templates[templateKey];
  if (!template) return null;

  return {
    subject: interpolate(template.subject, variables),
    body: interpolate(template.body, variables),
  };
}

/** Minimal HTML escape — the body is dictionary text with substituted values. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Keeps the shape of a message that has one.
 *
 * A body with blank lines and aligned columns — a handover with the whole file
 * in it — collapses into one run-on paragraph if the text is simply escaped
 * into a <p>. Blocks become paragraphs, and a block whose lines are padded to
 * a column stays monospaced so the columns still line up.
 */
function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const escaped = escapeHtml(block).replace(/\n/g, "<br>");
      return block.includes("\n")
        ? `<pre style="margin:0 0 16px;color:#57527d;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${escapeHtml(
            block,
          )}</pre>`
        : `<p style="margin:0 0 16px;color:#57527d">${escaped}</p>`;
    })
    .join("\n      ");
}

function htmlBody(rendered: Rendered, brand: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f3f9;padding:24px;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0d005d">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-.01em">${escapeHtml(brand)}</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.25">${escapeHtml(rendered.subject)}</h1>
      ${paragraphs(rendered.body)}
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Sends real transactional mail over SMTP.
 *
 * Bound only when `SMTP_HOST` is configured; otherwise the simulated provider
 * stays in place, so tests and a fresh checkout never reach for a mail server
 * that is not there.
 *
 * The same guard rails as the simulated provider apply — they live in
 * `assertSendable`, shared, so the implementation that actually reaches the
 * outside world cannot be the one where the rule was forgotten.
 *
 * SMS is not implemented here: this transport carries email. A caller asking
 * for SMS gets an explicit failure rather than a message silently dropped, and
 * `notify` records that failure against the application.
 */
export class SmtpNotificationProvider implements NotificationPort {
  readonly name = "smtp";
  private readonly outbox: SentMessage[] = [];
  private transporter: Transporter | null = null;

  constructor(private readonly settings: SmtpSettings) {}

  /** Created lazily and reused: the pool holds the TCP connection open. */
  private transport(): Transporter {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: this.settings.host,
        port: this.settings.port,
        secure: this.settings.secure,
        auth: this.settings.user
          ? { user: this.settings.user, pass: this.settings.password ?? "" }
          : undefined,
        pool: true,
        maxConnections: 3,
      });
    }
    return this.transporter;
  }

  async send(
    input: {
      channel: "EMAIL" | "SMS";
      to: string;
      replyTo?: string;
      templateKey: string;
      locale: string;
      variables: Record<string, string>;
    },
    _meta: ProviderCallMeta,
  ): Promise<{ messageId: string; status: "SENT" | "FAILED" }> {
    assertSendable(input.channel, input.variables);

    if (input.channel !== "EMAIL") {
      throw new Error(`The SMTP provider carries email only, not ${input.channel}`);
    }

    const rendered = render(input.templateKey, toLocale(input.locale), input.variables);
    if (!rendered) {
      // A template with no wording is a missing translation, not a transport
      // problem. Failing here surfaces it instead of mailing an empty body.
      throw new Error(`No wording for notification template "${input.templateKey}"`);
    }

    const brand = getDictionary(input.locale).common.brand;
    const info = await this.transport().sendMail({
      // The sender stays the authenticated account. Putting somebody else's
      // address here would be mail the receiving side cannot verify: Gmail
      // rewrites it outright, and any other server fails it on SPF or DKIM.
      // The person to answer goes in Reply-To, which is what it is for.
      from: this.settings.from,
      to: input.to,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      subject: rendered.subject,
      text: rendered.body,
      html: htmlBody(rendered, brand),
    });

    this.outbox.push({
      messageId: info.messageId,
      channel: input.channel,
      to: input.to,
      replyTo: input.replyTo,
      templateKey: input.templateKey,
      locale: input.locale,
      variables: input.variables,
      sentAt: new Date().toISOString(),
    });

    return { messageId: info.messageId, status: "SENT" };
  }

  messagesFor(recipient: string): SentMessage[] {
    return this.outbox.filter((message) => message.to === recipient);
  }

  /** Opens a connection and authenticates, without sending anything. */
  async verify(): Promise<void> {
    await this.transport().verify();
  }

  /**
   * Closes the pooled connections.
   *
   * A long-running server never calls this — the point of the pool is that the
   * socket stays open between messages. A one-shot script must, or the open
   * pool keeps the event loop alive and the process never exits.
   */
  close(): void {
    this.transporter?.close();
    this.transporter = null;
  }
}
