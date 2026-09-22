import assert from "node:assert/strict";
import { after, test } from "node:test";
import { providers } from "../../src/adapters";
import { SimulatedNotificationProvider } from "../../src/adapters/simulated/notifications";
import { CONTACT } from "../../src/server/config";
import { db } from "../../src/server/db";
import {
  AdminSetupRejected,
  MAX_ATTEMPTS,
  bootstrapAdminAccount,
  confirmAdminAccount,
  requestAdminAccount,
} from "../../src/server/services/adminSetup";

assert.ok(
  (process.env.DATABASE_URL ?? "").includes("test"),
  "Run the integration suites with DATABASE_URL pointing at the test database",
);

after(async () => {
  await db.$disconnect();
});

function freshEmail(): string {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@mail-test.com`;
}

/** The last code that reached the operations mailbox, as the reader would see it. */
function lastCodeSent(): string {
  const outbox = providers().notifications;
  assert.ok(outbox instanceof SimulatedNotificationProvider, "tests run against the in-memory outbox");
  const messages = outbox.messagesFor(CONTACT.opsEmail);
  const last = messages.at(-1);
  assert.ok(last, "a message reached the operations mailbox");
  assert.equal(last.templateKey, "admin_setup_code");
  return last.variables.code;
}

const request = (email: string) =>
  requestAdminAccount({
    email,
    firstName: "Test",
    lastName: "Admin",
    password: "correct-horse-battery-staple",
    passwordRepeat: "correct-horse-battery-staple",
    locale: "de",
  });

test("the code goes to the operations mailbox, and the right code opens an ADMIN account", async () => {
  const email = freshEmail();
  const { inviteId } = await request(email);
  const code = lastCodeSent();
  assert.match(code, /^\d{6}$/);

  // Nothing exists yet: the invite is not an account.
  assert.equal(await db.user.findUnique({ where: { email } }), null);

  const result = await confirmAdminAccount(inviteId, code);
  assert.equal(result.email, email);

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.role, "ADMIN");
  assert.equal(user.mustChangePassword, false);
  assert.equal(await db.adminInvite.findUnique({ where: { id: inviteId } }), null);

  const audit = await db.auditEntry.findFirst({
    where: { action: "admin_account_created", actorId: user.id },
  });
  assert.ok(audit, "the creation is on the audit trail");
});

test("a wrong code is refused, and the invite is gone after the last attempt", async () => {
  const email = freshEmail();
  const { inviteId } = await request(email);
  const code = lastCodeSent();
  const wrong = code === "000000" ? "111111" : "000000";

  for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
    await assert.rejects(confirmAdminAccount(inviteId, wrong), (e: AdminSetupRejected) => e.code === "codeInvalid");
  }
  await assert.rejects(confirmAdminAccount(inviteId, wrong), (e: AdminSetupRejected) => e.code === "codeExpired");

  // Even the right code no longer works: the invite has been destroyed.
  await assert.rejects(confirmAdminAccount(inviteId, code), (e: AdminSetupRejected) => e.code === "codeInvalid");
  assert.equal(await db.user.findUnique({ where: { email } }), null);
});

test("an address that already has an account is refused before any mail goes out", async () => {
  const email = freshEmail();
  await db.user.create({ data: { email, passwordHash: "x", role: "CUSTOMER" } });
  const before = (providers().notifications as SimulatedNotificationProvider).messagesFor(CONTACT.opsEmail).length;
  await assert.rejects(request(email), (e: AdminSetupRejected) => e.code === "emailTaken");
  const after_ = (providers().notifications as SimulatedNotificationProvider).messagesFor(CONTACT.opsEmail).length;
  assert.equal(after_, before);
});

test("an expired code is refused", async () => {
  const email = freshEmail();
  const { inviteId } = await request(email);
  const code = lastCodeSent();
  await db.adminInvite.update({ where: { id: inviteId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(confirmAdminAccount(inviteId, code), (e: AdminSetupRejected) => e.code === "codeExpired");
});

const bootstrap = (email: string, bootstrapKey: string) =>
  bootstrapAdminAccount({
    email,
    firstName: null,
    lastName: null,
    password: "correct-horse-battery-staple",
    passwordRepeat: "correct-horse-battery-staple",
    locale: "de",
    bootstrapKey,
  });

test("the setup key is refused whenever an administrator already exists", async () => {
  // Earlier tests in this file created one; the key is not even looked at.
  assert.ok((await db.user.count({ where: { role: "ADMIN" } })) > 0);
  const email = freshEmail();
  await assert.rejects(bootstrap(email, "whatever"), (e: AdminSetupRejected) => e.code === "bootstrapClosed");
  assert.equal(await db.user.findUnique({ where: { email } }), null);
});

test("with no administrator, a wrong setup key is refused and creates nothing", async () => {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  // Step them aside for a moment: the door is only open on an empty installation.
  await db.user.updateMany({ where: { role: "ADMIN" }, data: { role: "RISK" } });
  try {
    const email = freshEmail();
    await assert.rejects(bootstrap(email, "not-the-key"), (e: AdminSetupRejected) => e.code === "bootstrapKeyInvalid");
    assert.equal(await db.user.findUnique({ where: { email } }), null);
  } finally {
    await db.user.updateMany({ where: { id: { in: admins.map((a) => a.id) } }, data: { role: "ADMIN" } });
  }
});
