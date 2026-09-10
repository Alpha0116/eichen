import { db } from "../src/server/db";
import { collectDueInstalments } from "../src/server/services/servicing";

/**
 * Scheduled collection run.
 *
 * Safe to run repeatedly: collection is idempotent per loan and instalment, so
 * a retry after a crash cannot debit a borrower twice. In production this is a
 * cron job or a queue consumer; the logic it calls is the same either way.
 */
async function main() {
  const asOf = process.argv[2] ? new Date(process.argv[2]) : new Date();
  if (Number.isNaN(asOf.getTime())) throw new Error("usage: tsx scripts/collect-instalments.ts [ISO date]");

  const results = await collectDueInstalments(asOf);
  const settled = results.filter((row) => row.status === "SETTLED").length;
  const returned = results.length - settled;

  console.log(`As of ${asOf.toISOString().slice(0, 10)}: ${results.length} due, ${settled} settled, ${returned} returned.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
