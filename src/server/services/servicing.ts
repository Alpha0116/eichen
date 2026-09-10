import { providers } from "../../adapters";
import { buildAmortisationPlan } from "../../domain/finance/annuity";
import { computeSettlement } from "../../domain/finance/earlyRepayment";
import type { Offer } from "../../domain/offers/types";
import { recordAudit } from "../audit";
import { db } from "../db";
import { fromJsonWithDates, toJson } from "../json";
import { idempotencyKey, withRetry } from "../providerCall";
import { transition } from "./application";
import { notify } from "./notifications";
import type { Locale } from "../../i18n";

export class MissingPayoutAccountError extends Error {
  constructor() {
    super("The application carries no payout account");
    this.name = "MissingPayoutAccountError";
  }
}

export class AlreadyDisbursedError extends Error {
  constructor() {
    super("This application already has a loan");
    this.name = "AlreadyDisbursedError";
  }
}

function loanReference(applicationReference: string): string {
  return applicationReference.replace(/^EK-/, "KR-");
}

/**
 * Turns an approved application into a live loan.
 *
 * The repayment plan is rebuilt from the priced quote rather than copied from
 * the offer row, so the schedule that governs the borrower's payments is
 * produced by the same engine that produced the contract's figures. If the
 * borrower took the optional insurance, the insured variant is the one that
 * becomes the schedule.
 */
export async function disburse(applicationId: string, options: { agentId: string }) {
  const existing = await db.loan.findUnique({ where: { applicationId } });
  if (existing) throw new AlreadyDisbursedError();

  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { offers: { where: { selectedAt: { not: null } }, take: 1 } },
  });
  const offerRow = application.offers[0];
  if (!offerRow) throw new Error("No selected offer to disburse");

  // The payout account is the one the borrower gave with the rest of their
  // file, in its masked form. Asking an administrator to retype it at the
  // moment of payment would put a second, unchecked account number in the
  // path — and the one that matters is the one the borrower actually entered.
  const maskedIban = application.maskedIban;
  if (!maskedIban) throw new MissingPayoutAccountError();

  const offer = fromJsonWithDates<Offer | null>(offerRow.payloadJson, null);
  if (!offer) throw new Error("Stored offer could not be read");

  const insured = offerRow.insuranceSelected && offer.quote.withInsurance;
  const financedCharges = insured ? offer.quote.withInsurance!.premium : 0;

  const plan = buildAmortisationPlan({
    netAmount: offer.quote.netAmount,
    financedCharges,
    nominalAnnualRate: offer.nominalAnnualRate,
    termMonths: offer.quote.termMonths,
    firstDueDate: offer.quote.firstDueDate,
  });

  const registry = providers();
  const disbursement = await withRetry(
    idempotencyKey("disburse", applicationId),
    (meta) =>
      registry.payments.disburse(
        {
          applicationId,
          amount: offer.quote.netAmount,
          currency: application.currency,
          maskedIban,
        },
        meta,
      ),
    { attempts: 3 },
  );

  const loan = await db.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        applicationId,
        reference: loanReference(application.reference),
        lenderName: offer.lenderName,
        currency: application.currency,
        financedCapital: plan.financedCapital,
        netAmount: offer.quote.netAmount,
        nominalAnnualRate: offer.nominalAnnualRate,
        effectiveAnnualRate: offer.quote.effectiveAnnualRate,
        termMonths: offer.quote.termMonths,
        instalment: plan.instalment,
        status: "ACTIVE",
        disbursedAt: new Date(),
        maskedIban,
        mandateReference: `MND-${application.reference}`,
      },
    });

    await tx.instalment.createMany({
      data: plan.entries.map((entry) => ({
        loanId: created.id,
        index: entry.index,
        dueDate: entry.dueDate,
        amount: entry.payment,
        principal: entry.principal,
        interest: entry.interest,
        openingBalance: entry.openingBalance,
        closingBalance: entry.closingBalance,
        status: "SCHEDULED",
      })),
    });

    await tx.payment.create({
      data: {
        loanId: created.id,
        direction: "OUT",
        amount: offer.quote.netAmount,
        currency: application.currency,
        status: "SETTLED",
        reference: disbursement.reference,
        kind: "DISBURSEMENT",
        valueDate: new Date(disbursement.valueDate),
        reconciledAt: new Date(),
      },
    });

    return created;
  });

  await recordAudit({
    applicationId,
    action: "disbursed",
    actorType: "AGENT",
    actorId: options.agentId,
    payload: {
      loanId: loan.id,
      loanReference: loan.reference,
      netAmount: offer.quote.netAmount,
      instalments: plan.entries.length,
      valueDate: disbursement.valueDate,
    },
  });

  await transition(applicationId, "DISBURSED", "AGENT", { actorId: options.agentId });
  await transition(applicationId, "ACTIVE", "SYSTEM");

  const primary = await db.applicant.findFirst({ where: { applicationId, role: "PRIMARY" } });
  if (primary) {
    await notify({
      applicationId,
      channel: "EMAIL",
      to: primary.email,
      template: "disbursed",
      locale: application.locale as Locale,
      variables: { reference: application.reference },
    });
  }

  return loan;
}

/**
 * Collects every instalment that has fallen due.
 *
 * Collection is keyed on loan and instalment index at the provider, so running
 * this twice on the same day cannot debit a borrower twice. A returned direct
 * debit is recorded as such rather than retried here: chasing it belongs to
 * arrears handling, with its own rules and its own notices.
 */
export async function collectDueInstalments(asOf = new Date()) {
  const due = await db.instalment.findMany({
    where: {
      dueDate: { lte: asOf },
      status: { in: ["SCHEDULED", "DUE"] },
      loan: { status: "ACTIVE", autopayEnabled: true },
    },
    include: { loan: true },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  const registry = providers();
  const results: { instalmentId: string; status: string }[] = [];

  for (const instalment of due) {
    const outcome = await registry.payments.collect(
      {
        loanId: instalment.loanId,
        instalmentIndex: instalment.index,
        amount: instalment.amount,
        currency: instalment.loan.currency,
      },
      {
        idempotencyKey: idempotencyKey("collect", instalment.loanId, instalment.index),
        attempt: 1,
      },
    );

    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          loanId: instalment.loanId,
          instalmentId: instalment.id,
          direction: "IN",
          amount: instalment.amount,
          currency: instalment.loan.currency,
          status: outcome.status,
          reference: outcome.reference,
          returnCode: outcome.returnCode,
          kind: "INSTALMENT",
          valueDate: asOf,
          reconciledAt: outcome.status === "SETTLED" ? asOf : null,
        },
      });

      await tx.instalment.update({
        where: { id: instalment.id },
        data: {
          status: outcome.status === "SETTLED" ? "PAID" : "RETURNED",
          paidAt: outcome.status === "SETTLED" ? asOf : null,
          attempts: { increment: 1 },
        },
      });
    });

    await recordAudit({
      applicationId: instalment.loan.applicationId,
      action: "payment_recorded",
      actorType: "SYSTEM",
      payload: {
        loanId: instalment.loanId,
        instalmentIndex: instalment.index,
        status: outcome.status,
        returnCode: outcome.returnCode,
      },
    });

    results.push({ instalmentId: instalment.id, status: outcome.status });
  }

  await closeFullyRepaidLoans();
  return results;
}

async function closeFullyRepaidLoans(): Promise<void> {
  const active = await db.loan.findMany({
    where: { status: "ACTIVE" },
    include: { instalments: { where: { status: { not: "PAID" } }, take: 1 } },
  });

  for (const loan of active) {
    if (loan.instalments.length === 0) {
      await db.loan.update({
        where: { id: loan.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await transition(loan.applicationId, "CLOSED", "SYSTEM", { reason: "fully_repaid" });
      await recordAudit({
        applicationId: loan.applicationId,
        action: "loan_closed",
        actorType: "SYSTEM",
        payload: { loanId: loan.id, reason: "fully_repaid" },
      });
    }
  }
}

/**
 * Prices a full early repayment as of a date (P2 self-service).
 *
 * The plan is rebuilt from the loan's own terms so the compensation is computed
 * against the interest actually still owed, not against an estimate.
 */
export async function quoteSettlement(loanId: string, settlementDate = new Date()) {
  const loan = await db.loan.findUniqueOrThrow({
    where: { id: loanId },
    include: { instalments: { orderBy: { index: "asc" } } },
  });

  const plan = buildAmortisationPlan({
    netAmount: loan.netAmount,
    financedCharges: loan.financedCapital - loan.netAmount,
    nominalAnnualRate: loan.nominalAnnualRate,
    termMonths: loan.termMonths,
    firstDueDate: loan.instalments[0]?.dueDate ?? new Date(),
  });

  const paidInstalments = loan.instalments.filter((row) => row.status === "PAID").length;

  const settlement = computeSettlement({
    plan,
    nominalAnnualRate: loan.nominalAnnualRate,
    paidInstalments,
    settlementDate,
    drawdownDate: loan.disbursedAt ?? loan.createdAt,
  });

  const record = await db.settlementQuote.create({
    data: {
      loanId,
      outstandingPrincipal: settlement.outstandingPrincipal,
      accruedInterest: settlement.accruedInterest,
      compensation: settlement.compensation,
      compensationCapRate: settlement.compensationCapRate,
      interestSaved: settlement.interestSaved,
      totalToPay: settlement.totalToPay,
      reasonsJson: toJson(settlement.reasons),
      settlementDate,
      validUntil: settlement.validUntil,
    },
  });

  await recordAudit({
    applicationId: loan.applicationId,
    action: "settlement_quoted",
    actorType: "CUSTOMER",
    payload: {
      loanId,
      quoteId: record.id,
      totalToPay: settlement.totalToPay,
      compensation: settlement.compensation,
      capRate: settlement.compensationCapRate,
      reasons: settlement.reasons,
    },
  });

  return { settlement, record };
}

/** Accepts a settlement quote that is still within its validity. */
export async function acceptSettlement(quoteId: string) {
  const quote = await db.settlementQuote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { loan: true },
  });

  if (quote.acceptedAt) return quote;
  if (quote.validUntil < new Date()) throw new Error("This settlement quote has expired");

  await db.$transaction(async (tx) => {
    await tx.settlementQuote.update({
      where: { id: quoteId },
      data: { acceptedAt: new Date() },
    });
    await tx.payment.create({
      data: {
        loanId: quote.loanId,
        direction: "IN",
        amount: quote.totalToPay,
        currency: quote.loan.currency,
        status: "SETTLED",
        reference: `set_${quoteId}`,
        kind: "EARLY_REPAYMENT",
        valueDate: new Date(),
        reconciledAt: new Date(),
      },
    });
    await tx.instalment.updateMany({
      where: { loanId: quote.loanId, status: { in: ["SCHEDULED", "DUE", "LATE"] } },
      data: { status: "WAIVED" },
    });
    await tx.loan.update({
      where: { id: quote.loanId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  });

  await transition(quote.loan.applicationId, "CLOSED", "SYSTEM", { reason: "early_repayment" });
  await recordAudit({
    applicationId: quote.loan.applicationId,
    action: "loan_closed",
    actorType: "CUSTOMER",
    payload: { loanId: quote.loanId, reason: "early_repayment", amount: quote.totalToPay },
  });

  return quote;
}

export async function loanOverview(loanId: string) {
  const loan = await db.loan.findUniqueOrThrow({
    where: { id: loanId },
    include: {
      instalments: { orderBy: { index: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      settlements: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const paid = loan.instalments.filter((row) => row.status === "PAID");
  const next = loan.instalments.find((row) => row.status === "SCHEDULED" || row.status === "DUE");
  const outstanding = next ? next.openingBalance : 0;

  return { loan, paid: paid.length, next, outstanding };
}
