import { db } from "./../db";

export interface FunnelKpis {
  simulations: number;
  eligibilityRequests: number;
  submitted: number;
  approved: number;
  disbursed: number;
  /** Share of evaluated applications that a person had to look at, 0–1. */
  manualReviewRate: number;
  documentRejectRate: number;
  bankCheckFailureRate: number;
  medianDecisionMinutes: number | null;
  integrationFailures: number;
  /** Drop-off per funnel state, most populated first. */
  byState: { state: string; count: number }[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * The funnel and quality indicators from the reference document.
 *
 * Decision time is reported as a median rather than a mean: a handful of files
 * that sat over a weekend would drag an average far away from what a typical
 * applicant actually experiences.
 */
export async function funnelKpis(): Promise<FunnelKpis> {
  const [
    simulations,
    eligibilityRequests,
    submitted,
    approved,
    disbursed,
    decisions,
    documents,
    rejectedDocuments,
    bankChecks,
    failedBankChecks,
    states,
    decided,
  ] = await Promise.all([
    db.simulation.count(),
    db.decisionRecord.count(),
    db.application.count({ where: { submittedAt: { not: null } } }),
    db.application.count({ where: { state: { in: ["APPROVED", "DISBURSED", "ACTIVE", "CLOSED"] } } }),
    db.loan.count(),
    db.decisionRecord.findMany({ select: { outcome: true, overriddenAt: true } }),
    db.document.count(),
    db.document.count({ where: { status: "REJECTED" } }),
    db.bankCheck.count({ where: { status: { in: ["VERIFIED", "FAILED"] } } }),
    db.bankCheck.count({ where: { status: "FAILED" } }),
    db.application.groupBy({ by: ["state"], _count: { state: true } }),
    db.application.findMany({
      where: { submittedAt: { not: null }, decidedAt: { not: null } },
      select: { submittedAt: true, decidedAt: true },
    }),
  ]);

  const manualReviews = decisions.filter(
    (row) => row.outcome === "REFER" || row.overriddenAt !== null,
  ).length;

  const decisionMinutes = decided
    .map((row) => (row.decidedAt!.getTime() - row.submittedAt!.getTime()) / 60_000)
    .filter((minutes) => minutes >= 0);

  // Every provider call that ended in a state the funnel had to route around.
  const integrationFailures = await db.auditEntry.count({
    where: {
      OR: [
        { action: "bank_check_completed", payloadJson: { contains: '"status":"FAILED"' } },
        { action: "identity_completed", payloadJson: { contains: '"status":"FAILED"' } },
        { action: "bureau_checked", payloadJson: { contains: '"status":"UNAVAILABLE"' } },
      ],
    },
  });

  return {
    simulations,
    eligibilityRequests,
    submitted,
    approved,
    disbursed,
    manualReviewRate: ratio(manualReviews, decisions.length),
    documentRejectRate: ratio(rejectedDocuments, documents),
    bankCheckFailureRate: ratio(failedBankChecks, bankChecks),
    medianDecisionMinutes: median(decisionMinutes),
    integrationFailures,
    byState: states
      .map((row) => ({ state: row.state, count: row._count.state }))
      .sort((a, b) => b.count - a.count),
  };
}
