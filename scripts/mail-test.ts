// First, and before the imports that read the environment into constants.
import "./load-env";
import { smtpSettingsFromEnv, SmtpNotificationProvider } from "../src/adapters/smtp/notifications";
import { CONTACT } from "../src/server/config";

/**
 * Checks the SMTP configuration end to end.
 *
 * Connects and authenticates first, then sends one real message, so a failure
 * says which of the two went wrong — bad credentials and a rejected recipient
 * are different problems with different fixes.
 *
 *   npx tsx scripts/mail-test.ts [recipient]
 */
async function main() {
  const settings = smtpSettingsFromEnv();
  if (!settings) {
    // Says which of the two is wrong: nothing configured at all, or a block
    // that was started and left half-filled.
    console.error(
      process.env.SMTP_HOST?.trim()
        ? "SMTP_HOST is set but SMTP_USER or SMTP_PASSWORD is missing."
        : "SMTP_HOST is not set — notifications are still going to the in-memory outbox.",
    );
    console.error("Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM in .env.");
    process.exitCode = 1;
    return;
  }

  const to = process.argv[2] ?? CONTACT.opsEmail;
  const locale = "de";

  console.log(`host     ${settings.host}:${settings.port} (secure: ${settings.secure})`);
  console.log(`auth     ${settings.user ?? "none"}`);
  console.log(`from     ${settings.from}`);
  console.log(`to       ${to}`);

  // A sender that is not the authenticated account is the single most common
  // reason a configuration that connects still delivers nothing recognisable:
  // the provider either rewrites the header or the receiving side fails it on
  // SPF and DKIM. Worth saying before the message goes out, not after.
  const fromAddress = settings.from.match(/<([^>]+)>/)?.[1] ?? settings.from;
  const sameMailbox = (address: string) => address.toLowerCase().replace(/\+[^@]*/, "");

  if (settings.user && fromAddress.toLowerCase() !== settings.user.toLowerCase()) {
    console.warn(`\n!  SMTP_FROM (${fromAddress}) is not the authenticated account.`);
    if (sameMailbox(fromAddress) === sameMailbox(settings.user)) {
      // A sub-address of the same mailbox: the confirmation code arrives in
      // the account that is already being used, so this is a two-minute fix.
      console.warn("   It is a sub-address of the same mailbox. Declare it once as a send-as");
      console.warn("   identity with the provider and it arrives exactly as written.");
    } else {
      console.warn("   It only arrives as written if that address is a verified alias on the");
      console.warn("   sending account; otherwise the provider rewrites it or the recipient's");
      console.warn("   server rejects it on SPF or DKIM.");
    }
  }

  const provider = new SmtpNotificationProvider(settings);

  await provider.verify();
  console.log("\n✓ connected and authenticated");

  const result = await provider.send(
    {
      channel: "EMAIL",
      to,
      // A real template, so this also proves the wording resolves for the
      // locale — a message that sends but renders empty is not a success.
      templateKey: "contract_signed_ops",
      locale,
      variables: { reference: "EK-TEST-0001", borrower: "Test Testerin" },
    },
    { idempotencyKey: "mail-test", attempt: 1 },
  );

  console.log(`✓ sent (${result.status}) — message id ${result.messageId}`);

  // The pool keeps its socket open by design, so a one-shot script has to
  // let go of it. `close()` asks politely; a server that never answers the
  // QUIT would otherwise hold the event loop open for ever, and this script
  // has already done its job by the time it gets here.
  provider.close();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
}

main().catch((error) => {
  console.error("\n✗ failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
