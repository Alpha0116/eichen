import { priceLoan, type Quote } from "../../domain/finance/quote";
import type { LoanPurpose } from "../../domain/application/types";
import { recordAudit } from "../audit";
import { PRODUCT } from "../config";
import { db } from "../db";
import { toJson } from "../json";
import type { Locale } from "../../i18n";

export interface SimulationInput {
  amount: number;
  termMonths: number;
  purpose: LoanPurpose;
  locale: Locale;
}

export function clampAmount(amount: number): number {
  const stepped = Math.round(amount / PRODUCT.amountStep) * PRODUCT.amountStep;
  return Math.min(PRODUCT.maxAmount, Math.max(PRODUCT.minAmount, stepped));
}

export function clampTerm(termMonths: number): number {
  const stepped = Math.round(termMonths / PRODUCT.termStep) * PRODUCT.termStep;
  return Math.min(PRODUCT.maxTermMonths, Math.max(PRODUCT.minTermMonths, stepped));
}

/**
 * Prices the anonymous simulation at the public reference rate.
 *
 * This is a pure function of the three inputs — no identity, no cookie, no
 * stored profile. The reference funnel is explicit that a first calculation
 * must cost the visitor nothing, and that includes their data.
 */
export function referenceQuote(input: {
  amount: number;
  termMonths: number;
  drawdownDate?: Date;
}): Quote {
  return priceLoan({
    netAmount: clampAmount(input.amount),
    termMonths: clampTerm(input.termMonths),
    nominalAnnualRate: PRODUCT.referenceRate,
    currency: PRODUCT.currency,
    drawdownDate: input.drawdownDate ?? new Date(),
  });
}

/**
 * Persists a simulation for funnel analytics.
 *
 * The row carries the three parameters and the resulting figures, nothing that
 * identifies anyone. It exists so the landing-to-simulation conversion can be
 * measured without building a profile of the visitor.
 */
export async function recordSimulation(input: SimulationInput) {
  const quote = referenceQuote(input);

  const simulation = await db.simulation.create({
    data: {
      amount: quote.netAmount,
      termMonths: quote.termMonths,
      purpose: input.purpose,
      currency: PRODUCT.currency,
      country: PRODUCT.country,
      locale: input.locale,
      quoteJson: toJson({
        instalment: quote.base.instalment,
        effectiveAnnualRate: quote.effectiveAnnualRate,
        nominalAnnualRate: quote.nominalAnnualRate,
        totalPayable: quote.base.totalPayable,
        totalCreditCost: quote.base.totalCreditCost,
      }),
    },
  });

  await recordAudit({
    applicationId: null,
    action: "simulation_created",
    actorType: "SYSTEM",
    payload: {
      simulationId: simulation.id,
      amount: quote.netAmount,
      termMonths: quote.termMonths,
      purpose: input.purpose,
    },
  });

  return { simulation, quote };
}
