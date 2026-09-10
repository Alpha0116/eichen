import assert from "node:assert/strict";
import { test } from "node:test";
import { annuityInstalment, buildAmortisationPlan } from "../../src/domain/finance/annuity";
import { effectiveAnnualRate, flowsFromSchedule } from "../../src/domain/finance/apr";
import { computeSettlement } from "../../src/domain/finance/earlyRepayment";
import { addMonths, defaultFirstDueDate, yearFraction } from "../../src/domain/finance/dates";
import { priceLoan } from "../../src/domain/finance/quote";

const DRAWDOWN = new Date(Date.UTC(2026, 0, 15));
const FIRST_DUE = new Date(Date.UTC(2026, 1, 1));

test("annuity instalment matches the closed-form annuity formula", () => {
  const instalment = annuityInstalment(1_000_000, 0.0649 / 12, 48);
  const i = 0.0649 / 12;
  const expected = Math.round((1_000_000 * i) / (1 - Math.pow(1 + i, -48)));
  assert.equal(instalment, expected);
});

test("a zero-rate loan divides the capital evenly", () => {
  assert.equal(annuityInstalment(1_200_000, 0, 12), 100_000);
});

test("the schedule fully amortises and its parts add up", () => {
  const plan = buildAmortisationPlan({
    netAmount: 1_000_000,
    financedCharges: 0,
    nominalAnnualRate: 0.0649,
    termMonths: 48,
    firstDueDate: FIRST_DUE,
  });

  assert.equal(plan.entries.length, 48);
  assert.equal(plan.entries.at(-1)!.closingBalance, 0);

  for (const entry of plan.entries) {
    assert.equal(entry.payment, entry.principal + entry.interest);
    assert.equal(entry.closingBalance, entry.openingBalance - entry.principal);
  }

  const principalPaid = plan.entries.reduce((sum, e) => sum + e.principal, 0);
  assert.equal(principalPaid, plan.financedCapital);
  assert.equal(plan.totalPayable, plan.financedCapital + plan.totalInterest);

  // Only the closing instalment may differ, and only by rounding drift.
  const levels = plan.entries.slice(0, -1).map((e) => e.payment);
  assert.equal(new Set(levels).size, 1);
  assert.ok(Math.abs(plan.finalInstalment - plan.instalment) < 200);
});

test("financed charges raise the capital the interest runs on", () => {
  const withCharge = buildAmortisationPlan({
    netAmount: 1_000_000,
    financedCharges: 50_000,
    nominalAnnualRate: 0.06,
    termMonths: 24,
    firstDueDate: FIRST_DUE,
  });
  assert.equal(withCharge.financedCapital, 1_050_000);
  assert.ok(withCharge.instalment > annuityInstalment(1_000_000, 0.06 / 12, 24));
});

test("APR of a loan with no charges equals the compounded nominal rate", () => {
  const nominal = 0.0649;
  const plan = buildAmortisationPlan({
    netAmount: 1_000_000,
    financedCharges: 0,
    nominalAnnualRate: nominal,
    termMonths: 48,
    firstDueDate: addMonths(DRAWDOWN, 1),
  });

  const apr = effectiveAnnualRate({
    drawdown: 1_000_000,
    flows: flowsFromSchedule(DRAWDOWN, plan.entries),
  });

  const compounded = Math.pow(1 + nominal / 12, 12) - 1;
  // Cash flows fall on calendar dates, not exact twelfths of a year, so the
  // two figures agree to a few basis points rather than exactly.
  assert.ok(Math.abs(apr - compounded) < 0.001, `apr=${apr} compounded=${compounded}`);
  assert.ok(apr > nominal);
});

test("APR rises when a mandatory charge is financed", () => {
  const base = priceLoan({
    netAmount: 1_000_000,
    termMonths: 48,
    nominalAnnualRate: 0.0649,
    currency: "EUR",
    drawdownDate: DRAWDOWN,
    firstDueDate: FIRST_DUE,
  });
  const withFee = priceLoan({
    netAmount: 1_000_000,
    termMonths: 48,
    nominalAnnualRate: 0.0649,
    currency: "EUR",
    drawdownDate: DRAWDOWN,
    firstDueDate: FIRST_DUE,
    mandatoryCharges: 30_000,
  });
  assert.ok(withFee.effectiveAnnualRate > base.effectiveAnnualRate);
});

test("optional insurance is priced separately and never enters the APR", () => {
  const quote = priceLoan({
    netAmount: 1_000_000,
    termMonths: 48,
    nominalAnnualRate: 0.0649,
    currency: "EUR",
    drawdownDate: DRAWDOWN,
    firstDueDate: FIRST_DUE,
    optionalInsurancePremium: 80_000,
  });

  const withoutInsurance = priceLoan({
    netAmount: 1_000_000,
    termMonths: 48,
    nominalAnnualRate: 0.0649,
    currency: "EUR",
    drawdownDate: DRAWDOWN,
    firstDueDate: FIRST_DUE,
  });

  assert.equal(quote.effectiveAnnualRate, withoutInsurance.effectiveAnnualRate);
  assert.ok(quote.withInsurance);
  assert.ok(quote.withInsurance!.instalment > quote.base.instalment);
  assert.equal(
    quote.withInsurance!.extraCost,
    quote.withInsurance!.totalPayable - quote.base.totalPayable,
  );
});

test("early repayment compensation is capped at 1 % beyond a year", () => {
  const plan = buildAmortisationPlan({
    netAmount: 2_000_000,
    financedCharges: 0,
    nominalAnnualRate: 0.07,
    termMonths: 60,
    firstDueDate: FIRST_DUE,
  });

  const settlement = computeSettlement({
    plan,
    nominalAnnualRate: 0.07,
    paidInstalments: 12,
    settlementDate: addMonths(FIRST_DUE, 11),
    drawdownDate: DRAWDOWN,
  });

  assert.equal(settlement.compensationCapRate, 0.01);
  assert.equal(settlement.compensation, Math.round(settlement.outstandingPrincipal * 0.01));
  assert.ok(settlement.compensation <= settlement.interestSaved);
  assert.equal(
    settlement.totalToPay,
    settlement.outstandingPrincipal + settlement.accruedInterest + settlement.compensation,
  );
});

test("compensation drops to 0.5 % inside the final year and never exceeds remaining interest", () => {
  const plan = buildAmortisationPlan({
    netAmount: 2_000_000,
    financedCharges: 0,
    nominalAnnualRate: 0.07,
    termMonths: 60,
    firstDueDate: FIRST_DUE,
  });

  const settlement = computeSettlement({
    plan,
    nominalAnnualRate: 0.07,
    paidInstalments: 52,
    settlementDate: addMonths(FIRST_DUE, 51),
    drawdownDate: DRAWDOWN,
  });

  assert.equal(settlement.compensationCapRate, 0.005);
  assert.equal(settlement.remainingTermMonths, 8);
  assert.ok(settlement.compensation <= settlement.interestSaved);
});

test("a waived compensation is zero and says so", () => {
  const plan = buildAmortisationPlan({
    netAmount: 500_000,
    financedCharges: 0,
    nominalAnnualRate: 0.05,
    termMonths: 36,
    firstDueDate: FIRST_DUE,
  });
  const settlement = computeSettlement({
    plan,
    nominalAnnualRate: 0.05,
    paidInstalments: 6,
    settlementDate: addMonths(FIRST_DUE, 5),
    drawdownDate: DRAWDOWN,
    compensationWaived: true,
  });
  assert.equal(settlement.compensation, 0);
  assert.ok(settlement.reasons.includes("compensation.waived"));
});

test("addMonths clamps to the end of a shorter month", () => {
  const clamped = addMonths(new Date(Date.UTC(2026, 0, 31)), 1);
  assert.equal(clamped.toISOString().slice(0, 10), "2026-02-28");
});

test("the first due date is exactly one month after drawdown", () => {
  const drawdown = new Date(Date.UTC(2026, 0, 25));
  const first = defaultFirstDueDate(drawdown);
  assert.equal(first.toISOString().slice(0, 10), "2026-02-25");
  assert.ok(Math.abs(yearFraction(drawdown, first) - 1 / 12) < 0.01);
});

test("with periods aligned to the calendar, the APR is the compounded nominal rate", () => {
  const nominal = 0.0649;
  const drawdown = new Date(Date.UTC(2026, 0, 15));
  const quote = priceLoan({
    netAmount: 1_000_000,
    termMonths: 48,
    nominalAnnualRate: nominal,
    currency: "EUR",
    drawdownDate: drawdown,
  });
  const compounded = Math.pow(1 + nominal / 12, 12) - 1;
  // Month lengths still vary, so a couple of basis points of spread remain.
  assert.ok(
    Math.abs(quote.effectiveAnnualRate - compounded) < 0.0005,
    `apr=${quote.effectiveAnnualRate} compounded=${compounded}`,
  );
});
