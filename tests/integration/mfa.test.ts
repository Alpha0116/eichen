import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "../../src/server/db";
import {
  beginEnrolment,
  confirmEnrolment,
  disableMfa,
  mfaRequiredFor,
  remainingRecoveryCodes,
  verifyChallenge,
} from "../../src/server/auth/mfa";
import { codeForStep, stepFor } from "../../src/server/auth/totp";
import { hashPassword } from "../../src/server/auth/password";

assert.ok(
  (process.env.DATABASE_URL ?? "").includes("test"),
  "Run the integration suites with DATABASE_URL pointing at the test database",
);

after(async () => {
  await db.$disconnect();
});

async function makeUser(role: string) {
  return db.user.create({
    data: {
      email: `mfa-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@mail-test.com`,
      passwordHash: await hashPassword("a-long-enough-password"),
      role,
      locale: "de",
    },
  });
}

/** Runs `body` with the obligation configured, and restores it afterwards. */
async function withRequiredRoles(value: string | undefined, body: () => Promise<void> | void) {
  const previous = process.env.EICHEN_MFA_REQUIRED_ROLES;
  if (value === undefined) delete process.env.EICHEN_MFA_REQUIRED_ROLES;
  else process.env.EICHEN_MFA_REQUIRED_ROLES = value;
  try {
    await body();
  } finally {
    if (previous === undefined) delete process.env.EICHEN_MFA_REQUIRED_ROLES;
    else process.env.EICHEN_MFA_REQUIRED_ROLES = previous;
  }
}

test("no role is obliged to use a second factor by default", async () => {
  await withRequiredRoles(undefined, () => {
    for (const role of ["CUSTOMER", "AGENT", "RISK", "ADMIN"] as const) {
      assert.equal(mfaRequiredFor(role), false, `${role} must not be obliged by default`);
    }
  });
});

test("the obligation is configurable per role, and typos are ignored", async () => {
  await withRequiredRoles("AGENT, risk ,NOT_A_ROLE", () => {
    assert.equal(mfaRequiredFor("AGENT"), true);
    // Case and surrounding spaces are normalised.
    assert.equal(mfaRequiredFor("RISK"), true);
    // Not listed, so not obliged — a typo in the variable must not silently
    // widen the obligation, nor take the application down at boot.
    assert.equal(mfaRequiredFor("ADMIN"), false);
    assert.equal(mfaRequiredFor("CUSTOMER"), false);
  });
});

test("a candidate secret does not authenticate until it is confirmed", async () => {
  const user = await makeUser("AGENT");
  const enrolment = await beginEnrolment(user.id);

  const midway = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(midway.mfaEnabled, false);
  assert.equal(midway.mfaSecret, null);
  assert.equal(midway.mfaPendingSecret, enrolment.secret);

  // Abandoning enrolment must not lock the account out of anything.
  const challenge = await verifyChallenge(user.id, codeForStep(enrolment.secret, stepFor()));
  assert.equal(challenge.ok, false);
  if (!challenge.ok) assert.equal(challenge.reason, "NOT_ENROLLED");
});

test("a wrong code does not complete enrolment", async () => {
  const user = await makeUser("AGENT");
  await beginEnrolment(user.id);

  const result = await confirmEnrolment(user.id, "000000");
  assert.equal(result.ok, false);

  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(after.mfaEnabled, false);
});

test("confirming enrolment activates the secret and issues recovery codes", async () => {
  const user = await makeUser("ADMIN");
  const enrolment = await beginEnrolment(user.id);

  const result = await confirmEnrolment(user.id, codeForStep(enrolment.secret, stepFor()));
  assert.ok(result.ok);
  if (!result.ok) return;

  assert.equal(result.recoveryCodes.length, 8);
  assert.equal(new Set(result.recoveryCodes).size, 8);

  const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(stored.mfaEnabled, true);
  assert.equal(stored.mfaSecret, enrolment.secret);
  assert.equal(stored.mfaPendingSecret, null);
  assert.ok(stored.mfaEnrolledAt);

  // Only hashes are kept: no stored row may contain a code in the clear.
  const rows = await db.mfaRecoveryCode.findMany({ where: { userId: user.id } });
  assert.equal(rows.length, 8);
  for (const code of result.recoveryCodes) {
    assert.ok(!rows.some((row) => row.codeHash.includes(code.replace("-", ""))));
  }
});

test("a code cannot be replayed inside its own window", async () => {
  const user = await makeUser("AGENT");
  const enrolment = await beginEnrolment(user.id);
  const step = stepFor();
  await confirmEnrolment(user.id, codeForStep(enrolment.secret, step));

  // The enrolment itself consumed this step, so presenting it again must fail
  // even though the code is still within its 30-second validity.
  const replay = await verifyChallenge(user.id, codeForStep(enrolment.secret, step));
  assert.equal(replay.ok, false);

  const next = await verifyChallenge(user.id, codeForStep(enrolment.secret, step + 1));
  assert.equal(next.ok, true);
  if (next.ok) assert.equal(next.usedRecoveryCode, false);
});

test("a recovery code works exactly once", async () => {
  const user = await makeUser("RISK");
  const enrolment = await beginEnrolment(user.id);
  const result = await confirmEnrolment(user.id, codeForStep(enrolment.secret, stepFor()));
  assert.ok(result.ok);
  if (!result.ok) return;

  const [code] = result.recoveryCodes;
  const first = await verifyChallenge(user.id, code);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.usedRecoveryCode, true);
    assert.equal(first.remainingRecoveryCodes, 7);
  }

  const second = await verifyChallenge(user.id, code);
  assert.equal(second.ok, false);
  assert.equal(await remainingRecoveryCodes(user.id), 7);
});

test("repeated failures lock the account", async () => {
  const user = await makeUser("AGENT");
  const enrolment = await beginEnrolment(user.id);
  await confirmEnrolment(user.id, codeForStep(enrolment.secret, stepFor()));

  let locked = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await verifyChallenge(user.id, "000000");
    assert.equal(result.ok, false);
    if (!result.ok && result.reason === "LOCKED") locked = true;
  }
  assert.equal(locked, true);

  // A valid code is refused while the lock stands.
  const during = await verifyChallenge(user.id, codeForStep(enrolment.secret, stepFor() + 5));
  assert.equal(during.ok, false);
  if (!during.ok) assert.equal(during.reason, "LOCKED");
});

test("an account may turn its second factor off unless its role is obliged", async () => {
  const agent = await makeUser("AGENT");
  const agentEnrolment = await beginEnrolment(agent.id);
  await confirmEnrolment(agent.id, codeForStep(agentEnrolment.secret, stepFor()));

  // While the obligation is configured, the account that carries it cannot
  // opt out — otherwise the requirement is advisory rather than enforced.
  await withRequiredRoles("AGENT,RISK,ADMIN", async () => {
    await assert.rejects(disableMfa(agent.id), /mandatory/i);
  });

  // With no obligation configured — the default — the same account may.
  await disableMfa(agent.id);
  const agentAfter = await db.user.findUniqueOrThrow({ where: { id: agent.id } });
  assert.equal(agentAfter.mfaEnabled, false);

  const customer = await makeUser("CUSTOMER");
  const customerEnrolment = await beginEnrolment(customer.id);
  await confirmEnrolment(customer.id, codeForStep(customerEnrolment.secret, stepFor()));
  await disableMfa(customer.id);

  const after = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
  assert.equal(after.mfaEnabled, false);
  assert.equal(after.mfaSecret, null);
  assert.equal(await remainingRecoveryCodes(customer.id), 0);
});
