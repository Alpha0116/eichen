import { effectiveAnnualRate, flowsFromSchedule } from "./apr";
import { buildAmortisationPlan, type AmortisationPlan } from "./annuity";
import { defaultFirstDueDate } from "./dates";
import { type CurrencyCode, type Minor } from "./money";

export interface QuoteInput {
  netAmount: Minor;
  termMonths: number;
  /** Sollzins per year as a decimal. */
  nominalAnnualRate: number;
  currency: CurrencyCode;
  drawdownDate: Date;
  firstDueDate?: Date;
  /** Mandatory charges financed into the capital; these DO enter the APR. */
  mandatoryCharges?: Minor;
  /**
   * Single premium of an optional residual-debt insurance, financed into the
   * capital. Excluded from the APR by law, priced as a separate variant.
   */
  optionalInsurancePremium?: Minor;
}

export interface QuoteVariant {
  financedCapital: Minor;
  instalment: Minor;
  finalInstalment: Minor;
  totalPayable: Minor;
  /** Gesamtbetrag minus the money the borrower actually received. */
  totalCreditCost: Minor;
  plan: AmortisationPlan;
}

export interface Quote {
  netAmount: Minor;
  termMonths: number;
  currency: CurrencyCode;
  nominalAnnualRate: number;
  /** Effektiver Jahreszins on mandatory costs only. */
  effectiveAnnualRate: number;
  firstDueDate: Date;
  lastDueDate: Date;
  base: QuoteVariant;
  /** Present only when an optional insurance premium was quoted. */
  withInsurance?: QuoteVariant & { premium: Minor; extraCost: Minor };
}

function toVariant(plan: AmortisationPlan, netAmount: Minor): QuoteVariant {
  return {
    financedCapital: plan.financedCapital,
    instalment: plan.instalment,
    finalInstalment: plan.finalInstalment,
    totalPayable: plan.totalPayable,
    totalCreditCost: plan.totalPayable - netAmount,
    plan,
  };
}

/**
 * Prices a loan end to end: instalment, effective annual rate, total amount
 * payable and full repayment plan, plus the parallel figures if the borrower
 * takes the optional insurance.
 *
 * The insurance variant is deliberately a separate object rather than a flag on
 * the base quote: the UI must never present an optional cover as part of the
 * headline price, and the APR must never be computed from it.
 */
export function priceLoan(input: QuoteInput): Quote {
  const firstDueDate = input.firstDueDate ?? defaultFirstDueDate(input.drawdownDate);
  const mandatoryCharges = input.mandatoryCharges ?? 0;

  const basePlan = buildAmortisationPlan({
    netAmount: input.netAmount,
    financedCharges: mandatoryCharges,
    nominalAnnualRate: input.nominalAnnualRate,
    termMonths: input.termMonths,
    firstDueDate,
  });

  const apr = effectiveAnnualRate({
    drawdown: input.netAmount,
    flows: flowsFromSchedule(input.drawdownDate, basePlan.entries),
  });

  const base = toVariant(basePlan, input.netAmount);
  const quote: Quote = {
    netAmount: input.netAmount,
    termMonths: input.termMonths,
    currency: input.currency,
    nominalAnnualRate: input.nominalAnnualRate,
    effectiveAnnualRate: apr,
    firstDueDate,
    lastDueDate: basePlan.entries[basePlan.entries.length - 1].dueDate,
    base,
  };

  const premium = input.optionalInsurancePremium ?? 0;
  if (premium > 0) {
    const insuredPlan = buildAmortisationPlan({
      netAmount: input.netAmount,
      financedCharges: mandatoryCharges + premium,
      nominalAnnualRate: input.nominalAnnualRate,
      termMonths: input.termMonths,
      firstDueDate,
    });
    const variant = toVariant(insuredPlan, input.netAmount);
    quote.withInsurance = {
      ...variant,
      premium,
      extraCost: variant.totalPayable - base.totalPayable,
    };
  }

  return quote;
}
