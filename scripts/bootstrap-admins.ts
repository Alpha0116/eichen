// First, and before the imports that read the environment into constants.
import "./load-env";
import { randomBytes } from "node:crypto";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { CONTACT } from "../src/server/config";

/**
 * Puts the two administrator accounts on a database that has none.
 *
 * The difference from `reset-accounts.ts` is that this one destroys nothing.
 * It refuses to touch a database that already has an administrator, and it
 * skips any account whose address is already taken. That is what makes it safe
 * to point at production: the worst it can do is nothing.
 *
 *   DATABASE_URL="postgres://…" npx tsx scripts/bootstrap-admins.ts
 */

/** Readable, and from a real random source rather than a keyboard pattern. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15)}`;
}

async function main() {
  const existing = await db.user.count({ where: { role: "ADMIN" } });
  if (existing > 0) {
    console.log(`Nothing to do: ${existing} administrator account(s) already exist.`);
    console.log("This script only ever creates the first ones. To start over, use");
    console.log("scripts/reset-accounts.ts, which empties the database first.");
    return;
  }

  // The everyday administrator. The password printed below is known to whoever
  // runs this script, which is why the account carries `mustChangePassword`:
  // it cannot reach the back office until it has chosen one of its own.
  const adminEmail = (process.env.EICHEN_ADMIN_EMAIL ?? CONTACT.opsEmail).toLowerCase();
  const adminPassword = process.env.EICHEN_ADMIN_INITIAL_PASSWORD || generatePassword();

  await db.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      locale: "de",
      firstName: "Eichen",
      lastName: "Administration",
      mustChangePassword: true,
    },
  });

  console.log(`Administrator        ${adminEmail}`);
  console.log(`Initial password     ${adminPassword}`);
  console.log("                     must be changed at first login");

  // The break-glass account: a fixed password that is not changed on first
  // use, so there is always a way in when the everyday one is locked out.
  const superEmail = (process.env.EICHEN_SUPERADMIN_EMAIL ?? "").toLowerCase();
  const superPassword = process.env.EICHEN_SUPERADMIN_PASSWORD ?? "";

  if (!superEmail || !superPassword) {
    console.log("\nSecond account skipped: set EICHEN_SUPERADMIN_EMAIL and");
    console.log("EICHEN_SUPERADMIN_PASSWORD to create it.");
    return;
  }
  if (superEmail === adminEmail) {
    // Addresses are unique on the account table, and deliberately so: an
    // address is how a person is identified here.
    console.error("\nEICHEN_SUPERADMIN_EMAIL must differ from the administrator's address.");
    process.exitCode = 1;
    return;
  }

  await db.user.create({
    data: {
      email: superEmail,
      passwordHash: await hashPassword(superPassword),
      role: "ADMIN",
      locale: "de",
      firstName: "Eichen",
      lastName: "Super-Administration",
      mustChangePassword: false,
    },
  });
  console.log(`\nSuper administrator  ${superEmail} (fixed password, no change on first login)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
