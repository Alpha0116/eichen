import { db } from "../src/server/db";

/**
 * Removes every application and everything hanging off one.
 *
 * Reference data — accounts, the lender product, the published rule set — is
 * left alone, so the back office still works after a run and only the case
 * load is gone. Use it to clear the demonstration set (`seed-demo.ts`) before
 * showing the queue real applications.
 *
 * Deletion is ordered by hand rather than left to cascades. `Loan` and
 * `AuditEntry` deliberately do NOT cascade from an application — a file must
 * not be able to take its own audit trail with it — so removing them is an
 * explicit act, which is the point.
 */
async function main() {
  const applications = await db.application.findMany({ select: { id: true } });
  const ids = applications.map((row) => row.id);
  if (ids.length === 0) {
    console.log("No applications to remove.");
    return;
  }

  const loans = await db.loan.findMany({
    where: { applicationId: { in: ids } },
    select: { id: true },
  });
  const loanIds = loans.map((row) => row.id);

  // Deepest rows first: payments reference both an instalment and a loan, so
  // they cannot outlive either.
  const payments = await db.payment.deleteMany({ where: { loanId: { in: loanIds } } });
  const settlements = await db.settlementQuote.deleteMany({ where: { loanId: { in: loanIds } } });
  const instalments = await db.instalment.deleteMany({ where: { loanId: { in: loanIds } } });
  const removedLoans = await db.loan.deleteMany({ where: { id: { in: loanIds } } });
  const audit = await db.auditEntry.deleteMany({ where: { applicationId: { in: ids } } });
  // Simulations point at an application without a foreign key, so they are
  // detached rather than deleted — the funnel-conversion figures on the KPI
  // page are about visits, not about files that still exist.
  const simulations = await db.simulation.updateMany({
    where: { applicationId: { in: ids } },
    data: { applicationId: null },
  });
  // Applicants, household, consents, documents, offers, contracts, account
  // fee, notifications and tickets all cascade from the application itself.
  const removed = await db.application.deleteMany({ where: { id: { in: ids } } });

  console.log(`Removed ${removed.count} applications:`);
  console.log(`  loans ${removedLoans.count}, instalments ${instalments.count}`);
  console.log(`  payments ${payments.count}, settlements ${settlements.count}`);
  console.log(`  audit entries ${audit.count}, simulations detached ${simulations.count}`);
  console.log("\nAccounts, the lender product and the rule set are untouched.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
