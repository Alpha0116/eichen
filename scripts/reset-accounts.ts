// First, and before the imports that read the environment into constants.
import "./load-env";
import { randomBytes } from "node:crypto";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { CONTACT } from "../src/server/config";

/**
 * Empties the database of people and their files, then puts back two accounts.
 *
 * Everything a person ever entered goes: applications and everything hanging
 * off one, and then every account, staff included. What stays is the
 * configuration the application cannot run without — the lender catalogue and
 * the published rule sets — because those are the codebase's own reference
 * data rather than anybody's personal data.
 *
 * Refuses to run without `--yes`. This is not a step anyone should discover
 * they have taken.
 *
 *   npx tsx scripts/reset-accounts.ts --yes
 */

/** Readable, and from a real random source rather than a keyboard pattern. now update script */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15)}`;
}

async function wipe() {
  // Deletion is ordered by hand rather than left to cascades. `Loan` and
  // `AuditEntry` deliberately do NOT cascade from an application — a file must
  // not be able to take its own audit trail with it — so removing them is an
  // explicit act, which is the point.
  const loanIds = (await db.loan.findMany({ select: { id: true } })).map((row) => row.id);

  const payments = await db.payment.deleteMany({ where: { loanId: { in: loanIds } } });
  const settlements = await db.settlementQuote.deleteMany({ where: { loanId: { in: loanIds } } });
  const instalments = await db.instalment.deleteMany({ where: { loanId: { in: loanIds } } });
  const loans = await db.loan.deleteMany({});
  const audit = await db.auditEntry.deleteMany({});
  const notifications = await db.notification.deleteMany({});
  const simulations = await db.simulation.deleteMany({});
  const dataRequests = await db.dataRequest.deleteMany({});
  // Applicants, household, consents, documents, offers, contracts, account
  // fee and tickets cascade from the application; sessions, recovery codes,
  // consents and tickets cascade from the account.
  const applications = await db.application.deleteMany({});
  const users = await db.user.deleteMany({});

  console.log("Removed:");
  console.log(`  applications ${applications.count}, accounts ${users.count}`);
  console.log(`  loans ${loans.count}, instalments ${instalments.count}, payments ${payments.count}`);
  console.log(`  settlement quotes ${settlements.count}, audit entries ${audit.count}`);
  console.log(`  notifications ${notifications.count}, simulations ${simulations.count}`);
  console.log(`  data requests ${dataRequests.count}`);
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This removes every application and every account, including staff.");
    console.error("Re-run with --yes if that is what you mean.");
    process.exitCode = 1;
    return;
  }

  await wipe();

  // The everyday administrator. The password below is known to whoever runs
  // this script, which is exactly why the account carries
  // `mustChangePassword`: it cannot reach the back office until it has chosen
  // one of its own, and every other session is dropped when it does.
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

  // The break-glass account: a fixed password that is not changed on first
  // use, so there is always a way in when the everyday one is locked out or
  // its second factor is on a device nobody has any more.
  const superEmail = (process.env.EICHEN_SUPERADMIN_EMAIL ?? "").toLowerCase();
  const superPassword = process.env.EICHEN_SUPERADMIN_PASSWORD ?? "";

  if (!superEmail || !superPassword) {
    console.log("\nSecond account skipped: set EICHEN_SUPERADMIN_EMAIL and");
    console.log("EICHEN_SUPERADMIN_PASSWORD to create it.");
  } else if (superEmail === adminEmail) {
    // Addresses are unique on the account table, and deliberately so: an
    // address is how a person is identified here, and two accounts answering
    // to one address is not something the login could resolve.
    console.error("\nEICHEN_SUPERADMIN_EMAIL must differ from the administrator's address.");
    process.exitCode = 1;
  } else {
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

  console.log(`\nAdministrator        ${adminEmail}`);
  console.log(`Initial password     ${adminPassword}`);
  console.log("                     must be changed at first login");
  console.log("\nNo customer accounts were created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
