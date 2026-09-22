import { addDays } from "../finance/dates";
import { priceLoan } from "../finance/quote";
import { roundMinor, type Minor } from "../finance/money";
import type { ApplicationSnapshot } from "../application/types";
import type { Decision } from "../rules/types";
import type { Ineligibility, LenderProduct, Offer, OfferSet, OfferStatus } from "./types";

export interface MatchingInput {
  snapshot: ApplicationSnapshot;
  decision: Decision;
  products: readonly LenderProduct[];
  /** Amount finally granted, which a band may have cut below the request. */
  grantedAmount: Minor;
  drawdownDate: Date;
  status: OfferStatus;
  offerValidDays?: number;
  now?: Date;
  /**
   * Price every product even when it does not fit the request.
   *
   * The issues are still collected, so the file says what does not match and
   * an administrator sees it; what changes is that they no longer stop the
   * application. Refusing is a person's decision taken on the file, not the
   * catalogue's answer to a form.
   */
  ignoreEligibility?: boolean;
}

function ageAtMaturity(birthDate: string, termMonths: number, now: Date): number | null {
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const maturity = new Date(now.getTime());
  maturity.setUTCMonth(maturity.getUTCMonth() + termMonths);
  let age = maturity.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = maturity.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && maturity.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

function eligibilityIssues(
  product: LenderProduct,
  input: MatchingInput,
  amount: Minor,
  now: Date,
): string[] {
  const { snapshot } = input;
  const { applicant, request, bankCheck } = snapshot;
  const issues: string[] = [];

  if (product.country !== applicant.country) issues.push("ineligible.country");
  if (product.currency !== request.currency) issues.push("ineligible.currency");
  // The amount is never a ground for refusal. Whatever the borrower asks for
  // is carried through to the back office, where a person decides — cutting a
  // request to fit a product's bounds, or refusing it, is their judgement and
  // not a rule the funnel applies on its own.
  if (request.termMonths < product.minTermMonths) issues.push("ineligible.term_below_min");
  if (request.termMonths > product.maxTermMonths) issues.push("ineligible.term_above_max");
  if (!product.allowedPurposes.includes(request.purpose)) issues.push("ineligible.purpose");
  if (!product.allowedEmployment.includes(applicant.employmentType)) {
    issues.push("ineligible.employment");
  }
  if (applicant.netMonthlyIncome < product.minNetMonthlyIncome) issues.push("ineligible.income");
  if (product.requiresBankCheck && bankCheck.status !== "VERIFIED") {
    issues.push("ineligible.bank_check_required");
  }
  if (snapshot.coApplicant && !product.features.coBorrowerAllowed) {
    issues.push("ineligible.co_borrower");
  }

  const maturityAge = ageAtMaturity(applicant.birthDate, request.termMonths, now);
  if (maturityAge !== null && maturityAge > product.maxAgeAtMaturity) {
    issues.push("ineligible.age_at_maturity");
  }

  return issues;
}

function priceFor(product: LenderProduct, input: MatchingInput): { rate: number; factors: string[] } {
  const factors: string[] = ["pricing.base_rate"];
  let rate = product.baseRate;

  const grade = input.decision.band?.grade ?? "D";
  const gradeSpread = product.gradeSpread[grade] ?? input.decision.band?.rateSpread ?? 0.05;
  if (gradeSpread !== 0) {
    rate += gradeSpread;
    factors.push("pricing.risk_grade");
  }

  const purposeAdjustment = product.purposeAdjustment[input.snapshot.request.purpose] ?? 0;
  if (purposeAdjustment !== 0) {
    rate += purposeAdjustment;
    factors.push("pricing.purpose");
  }

  if (input.snapshot.request.termMonths > product.longTermThresholdMonths) {
    rate += product.longTermAdjustment;
    factors.push("pricing.term_length");
  }

  // A lender never pays the borrower to borrow: the floor is zero, not negative.
  return { rate: Math.max(0, rate), factors };
}

/**
 * Prices the application against the catalogue.
 *
 * The catalogue holds a single product at a flat rate, so in practice this
 * returns one offer or an ineligibility. The loop and the sort are kept rather
 * than collapsed into a single-product special case: they cost nothing, and
 * they are what makes adding a second product a data change instead of a
 * rewrite of the pricing path.
 */
export function matchOffers(input: MatchingInput): OfferSet {
  const now = input.now ?? new Date();
  const offers: Offer[] = [];
  const ineligible: Ineligibility[] = [];

  const bandFactor = input.decision.band?.maxAmountFactor ?? 1;
  const amount = Math.min(input.grantedAmount, roundMinor(input.snapshot.request.amount * bandFactor));

  for (const product of input.products) {
    const issues = eligibilityIssues(product, input, amount, now);
    if (issues.length > 0) {
      ineligible.push({
        productId: product.id,
        lenderName: product.lenderName,
        reasonCodes: issues,
      });
      if (!input.ignoreEligibility) continue;
    }

    const { rate, factors } = priceFor(product, input);
    const insurancePremium =
      product.insurancePremiumRate === null
        ? 0
        : roundMinor(amount * product.insurancePremiumRate * (input.snapshot.request.termMonths / 12));

    const quote = priceLoan({
      netAmount: amount,
      termMonths: input.snapshot.request.termMonths,
      nominalAnnualRate: rate,
      currency: input.snapshot.request.currency,
      drawdownDate: input.drawdownDate,
      optionalInsurancePremium: insurancePremium,
    });

    offers.push({
      productId: product.id,
      lenderName: product.lenderName,
      lenderKind: product.lenderKind,
      supervisionNote: product.supervisionNote,
      status: input.status,
      grade: input.decision.band?.grade ?? "D",
      nominalAnnualRate: rate,
      quote,
      features: product.features,
      insuranceAvailable: product.insurancePremiumRate !== null,
      sponsored: product.sponsored,
      commissionBps: product.commissionBps,
      expectedPayoutDays: product.expectedPayoutDays,
      validUntil: addDays(now, input.offerValidDays ?? 14).toISOString(),
      pricingFactors: factors,
    });
  }

  offers.sort((a, b) => {
    const delta = a.quote.effectiveAnnualRate - b.quote.effectiveAnnualRate;
    // Ties break on total cost, then on lender name, so the order is stable
    // across requests instead of depending on catalogue insertion order.
    if (Math.abs(delta) > 1e-12) return delta;
    const cost = a.quote.base.totalCreditCost - b.quote.base.totalCreditCost;
    if (cost !== 0) return cost;
    return a.lenderName.localeCompare(b.lenderName);
  });

  return { offers, ineligible, rankedBy: "EFFECTIVE_RATE_ASC", generatedAt: now.toISOString() };
}
