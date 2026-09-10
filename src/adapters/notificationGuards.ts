/**
 * What may leave the building in a message.
 *
 * Shared by every notification provider rather than living in one of them: a
 * real SMTP sender must not be the implementation where the rule quietly stops
 * applying. Both checks throw, so a violation is a bug that surfaces, not a
 * message that goes out anyway.
 */
export function assertSendable(
  channel: "EMAIL" | "SMS",
  variables: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(variables)) {
    // Outstanding balances, IBANs and one-time codes do not belong in a
    // channel the recipient's lock screen can display.
    if (channel === "SMS" && /iban|balance|amount_due|password|code/i.test(key)) {
      throw new Error(`Refusing to send "${key}" over SMS`);
    }
    if (value.length > 200) throw new Error(`Notification variable "${key}" is too long`);
  }
}
