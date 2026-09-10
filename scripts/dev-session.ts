import { createHash, randomBytes } from "node:crypto";
import { db } from "../src/server/db";
import { mfaRequiredFor } from "../src/server/auth/mfa";
import { codeForStep, generateSecret, stepFor } from "../src/server/auth/totp";
import type { Role } from "../src/server/auth/session";

/**
 * Mints a session for a demo account and prints the raw cookie value.
 *
 * Only the hash is stored, exactly as the login flow does, so this is a real
 * session rather than a bypass — it just skips typing the password. Intended
 * for local smoke checks.
 */
async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: tsx scripts/dev-session.ts <email> [--pending]");

  // --pending mints a session that has passed the password but not the second
  // factor, which is the state the MFA pages are meant to be reached in.
  const pending = process.argv.includes("--pending");
  const user = await db.user.findUniqueOrThrow({ where: { email } });

  if (pending) {
    const token = randomBytes(32).toString("base64url");
    await db.session.create({
      data: {
        userId: user.id,
        mfaPending: true,
        tokenHash: createHash("sha256").update(token, "utf8").digest("hex"),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    console.log(token);
    return;
  }

  // Staff cannot hold a session without a second factor, so rather than
  // bypassing that rule, enrol the account and print a valid code. The session
  // this mints is then a real one, subject to every guard.
  if (mfaRequiredFor(user.role as Role) && !user.mfaEnabled) {
    const secret = generateSecret();
    await db.user.update({
      where: { id: user.id },
      data: { mfaSecret: secret, mfaEnabled: true, mfaEnrolledAt: new Date(), mfaPendingSecret: null },
    });
    console.error(`enrolled ${email} in MFA; current code ${codeForStep(secret, stepFor())}`);
  }

  const token = randomBytes(32).toString("base64url");

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token, "utf8").digest("hex"),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  console.log(token);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
