import { providers } from "../../adapters";
import { db } from "../db";
import { toJson } from "../json";
import { idempotencyKey } from "../providerCall";
import type { Locale } from "../../i18n";

export type NotificationTemplate =
  | "application_incomplete"
  | "application_submitted"
  | "decision_ready"
  | "documents_required"
  | "contract_ready"
  | "contract_signed_ops"
  | "account_fee_due"
  | "disbursed"
  | "instalment_due"
  | "payment_failed";

export interface NotifyInput {
  applicationId: string | null;
  channel: "EMAIL" | "SMS";
  to: string;
  /** Where a reply should go, when that is not the configured sender. */
  replyTo?: string;
  template: NotificationTemplate;
  locale: Locale;
  variables?: Record<string, string>;
}

/**
 * Sends a transactional message and records that it was sent.
 *
 * A failure here never propagates: a borrower's application must not roll back
 * because an email provider was briefly down. The failed attempt is stored so
 * the back office can see the gap and resend.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const registry = providers();
  const variables = input.variables ?? {};

  let status: "SENT" | "FAILED" = "FAILED";
  let messageId: string | null = null;

  try {
    const result = await registry.notifications.send(
      {
        channel: input.channel,
        to: input.to,
        replyTo: input.replyTo,
        templateKey: input.template,
        locale: input.locale,
        variables,
      },
      { idempotencyKey: idempotencyKey("notify", input.applicationId ?? "-", input.template), attempt: 1 },
    );
    status = result.status;
    messageId = result.messageId;
  } catch {
    status = "FAILED";
  }

  await db.notification.create({
    data: {
      applicationId: input.applicationId,
      channel: input.channel,
      recipient: input.to,
      templateKey: input.template,
      locale: input.locale,
      variablesJson: toJson(variables),
      status,
      messageId,
    },
  });
}
