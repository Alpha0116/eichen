import { matchOffers } from "../../domain/offers/matching";
import type { LenderProduct, OfferSet } from "../../domain/offers/types";
import { evaluate } from "../../domain/rules/engine";
import { buildFacts } from "../../domain/rules/facts";
import type { Decision } from "../../domain/rules/types";
import { recordAudit } from "../audit";
import { PRODUCT } from "../config";
import { db } from "../db";
import { fromJson, toJson } from "../json";
import { loadSnapshot, transition } from "./application";
import { assertConsents } from "./consent";
import { notify } from "./notifications";
import { publishedRuleSet } from "./rules";
import type { Locale } from "../../i18n";

export class NoEligibleProductError extends Error {
  constructor(public readonly reasonCodes: string[]) {
    super(`No product matches this request: ${reasonCodes.join(", ")}`);
    this.name = "NoEligibleProductError";
  }
}

export interface SubmissionResult {
  decision: Decision;
  offerSet: OfferSet;
  affordability: ReturnType<typeof buildFacts>["affordability"];
}

async function activeProducts(country: string): Promise<LenderProduct[]> {
  const rows = await db.lenderProductRecord.findMany({ where: { country, active: true } });
  return rows
    .map((row) => fromJson<LenderProduct | null>(row.payloadJson, null))
    .filter((product): product is LenderProduct => product !== null);
}

/**
 * Hands a completed application to the administrators.
 *
 * Three things happen, in this order and for distinct reasons:
 *
 *  1. The rule set is evaluated. Its output is **advice**, written to the
 *     decision record so an administrator can see the arithmetic and the
 *     reasons — it never moves the application anywhere. No bureau is queried,
 *     so the bureau facts stay unknown and the engine closes to REFER, which
 *     is the honest answer: nobody has looked yet.
 *  2. The loan is priced at the single 3 % rate, and the resulting offer is
 *     stored already selected. There is nothing to choose between, so asking
 *     the borrower to pick would be theatre.
 *  3. The application moves to SUBMITTED and waits for a person.
 *
 * Pricing runs before the state change: an application that cannot be priced
 * at all — a term outside the product's range, say — must be refused here,
 * while the borrower can still edit it, rather than land in the queue as a
 * file no administrator can act on.
 */
export async function submitApplication(
  applicationId: string,
  options: { actorId?: string | null } = {},
): Promise<SubmissionResult> {
  await assertConsents(applicationId, "SUBMISSION");

  const snapshot = await loadSnapshot(applicationId);
  const country = snapshot.applicant.country || PRODUCT.country;

  const ruleSet = await publishedRuleSet(country);
  const { facts, affordability } = buildFacts(snapshot, ruleSet.affordability, PRODUCT.referenceRate);
  const decision = evaluate(ruleSet, facts);

  const offerSet = matchOffers({
    snapshot,
    decision,
    products: await activeProducts(country),
    grantedAmount: snapshot.request.amount,
    drawdownDate: new Date(),
    status: "SUBJECT_TO_VERIFICATION",
    offerValidDays: PRODUCT.offerValidDays,
  });

  const offer = offerSet.offers[0];
  if (!offer) {
    throw new NoEligibleProductError(offerSet.ineligible.flatMap((row) => row.reasonCodes));
  }

  await db.$transaction(async (tx) => {
    await tx.decisionRecord.create({
      data: {
        applicationId,
        outcome: decision.outcome,
        score: decision.score,
        grade: decision.band?.grade ?? null,
        ruleSetKey: decision.ruleSetKey,
        ruleSetVersion: decision.ruleSetVersion,
        factsJson: toJson(decision.facts),
        firedRulesJson: toJson(decision.firedRules),
        principalReasonsJson: toJson(decision.principalReasonCodes),
        affordabilityJson: toJson(affordability),
      },
    });

    await tx.application.update({
      where: { id: applicationId },
      data: {
        ruleSetKey: decision.ruleSetKey,
        ruleSetVersion: decision.ruleSetVersion,
        // The requested amount, pending an administrator's judgement. Cutting
        // it is their call, made on the file, not a band's multiplier.
        grantedAmount: snapshot.request.amount,
      },
    });

    // A resubmission after a send-back replaces the previous pricing rather
    // than adding to it: two live offers on one application is a way to show
    // a borrower a price that no longer applies.
    await tx.offer.deleteMany({ where: { applicationId } });
    await tx.offer.create({
      data: {
        applicationId,
        productId: offer.productId,
        lenderName: offer.lenderName,
        status: offer.status,
        grade: offer.grade,
        nominalAnnualRate: offer.nominalAnnualRate,
        effectiveAnnualRate: offer.quote.effectiveAnnualRate,
        instalment: offer.quote.base.instalment,
        totalPayable: offer.quote.base.totalPayable,
        totalCreditCost: offer.quote.base.totalCreditCost,
        netAmount: offer.quote.netAmount,
        termMonths: offer.quote.termMonths,
        payloadJson: toJson(offer),
        sponsored: offer.sponsored,
        commissionBps: offer.commissionBps,
        validUntil: new Date(offer.validUntil),
        selectedAt: new Date(),
      },
    });
  });

  await recordAudit({
    applicationId,
    action: "application_submitted",
    actorType: "CUSTOMER",
    actorId: options.actorId ?? null,
    payload: {
      amount: snapshot.request.amount,
      termMonths: snapshot.request.termMonths,
      nominalAnnualRate: offer.nominalAnnualRate,
      effectiveAnnualRate: offer.quote.effectiveAnnualRate,
      instalment: offer.quote.base.instalment,
      recommendation: decision.outcome,
      score: decision.score,
      ruleSetKey: decision.ruleSetKey,
      ruleSetVersion: decision.ruleSetVersion,
      principalReasons: decision.principalReasonCodes,
    },
  });

  await transition(applicationId, "SUBMITTED", "CUSTOMER", { actorId: options.actorId });

  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { locale: true, reference: true, applicants: { where: { role: "PRIMARY" }, take: 1 } },
  });
  const primary = application.applicants[0];
  if (primary?.email) {
    await notify({
      applicationId,
      channel: "EMAIL",
      to: primary.email,
      template: "application_submitted",
      locale: application.locale as Locale,
      variables: { reference: application.reference },
    });
  }

  return { decision, offerSet, affordability };
}
