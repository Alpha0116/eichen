import { randomUUID } from "node:crypto";
import { assertSendable } from "../notificationGuards";
import type { NotificationPort, ProviderCallMeta, SentMessage } from "../ports";

/**
 * Stand-in for the transactional email and SMS provider.
 *
 * Messages are addressed by template key and locale, never by literal body, so
 * the wording lives in the dictionaries and can be reviewed and translated
 * without touching code. Variables are substituted by the provider; the caller
 * is responsible for passing only non-sensitive values, which is enforced here.
 */
export class SimulatedNotificationProvider implements NotificationPort {
  readonly name = "simulated-notifications";
  private readonly outbox: SentMessage[] = [];

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

    const message: SentMessage = {
      messageId: `msg_${randomUUID()}`,
      channel: input.channel,
      to: input.to,
      replyTo: input.replyTo,
      templateKey: input.templateKey,
      locale: input.locale,
      variables: input.variables,
      sentAt: new Date().toISOString(),
    };
    this.outbox.push(message);
    return { messageId: message.messageId, status: "SENT" };
  }

  /** Read-only view used by the back office to show what a borrower received. */
  messagesFor(recipient: string): SentMessage[] {
    return this.outbox.filter((message) => message.to === recipient);
  }
}
