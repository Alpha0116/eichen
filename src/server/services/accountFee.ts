import { randomBytes } from "node:crypto";
import { providers } from "../../adapters";
import type { CardPayment } from "../../adapters/ports";
import { addDays } from "../../domain/finance/dates";
import { recordAudit } from "../audit";
import { ACCOUNT_FEE, accountFeeFor } from "../config";
import { db } from "../db";
import { idempotencyKey } from "../providerCall";
import { transition } from "./application";
import { assertConsents } from "./consent";
import { notify } from "./notifications";
import type { Locale } from "../../i18n";

/**
 * How a settled fee says it was settled.
 *
 * CARD is the on-site charge, which the borrower no longer sees: the fee is
 * arranged with support, so what actually settles a fee today is an
 * administrator confirming the money arrived, recorded as MANUAL. The column
 * matters precisely because there is now more than one answer.
 */
export const FEE_CHARGE_METHOD = "CARD";
export const FEE_MANUAL_METHOD = "MANUAL";

/**
 * Payment reference the borrower quotes on the transfer.
 *
 * Prefixed and grouped so it survives being read down a phone line, and drawn
 * from random bytes rather than derived from the application id — a reference
 * that encodes an internal id hands anyone who sees a bank statement a way to
 * address the record.
 */
function feeReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i += 1) body += alphabet[bytes[i] % alphabet.length];
  return `EG-${body.slice(0, 4)}-${body.slice(4)}`;
}

export class FeeNotPayableError extends Error {
  constructor(public readonly code: "ALREADY_PAID" | "EXPIRED" | "NOT_ISSUED") {
    super(code);
    this.name = "FeeNotPayableError";
  }
}

export class ChargeDeclinedError extends Error {
  constructor(public readonly declineCode: string) {
    super(`Charge declined: ${declineCode}`);
    this.name = "ChargeDeclinedError";
  }
}

/**
 * Issues the account fee once the contract is signed.
 *
 * Idempotent: an application that already carries a fee gets the existing row
 * back rather than a second one, so a reloaded page or a replayed signature
 * callback cannot bill twice. The amount is computed from the granted amount
 * at the moment of issue and then frozen on the row — re-deriving it at
 * payment time would let a later edit change what the borrower agreed to pay.
 */
export async function issueAccountFee(applicationId: string) {
  const existing = await db.accountFee.findUnique({ where: { applicationId } });
  if (existing) return existing;

  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: {
      amount: true,
      grantedAmount: true,
      currency: true,
      locale: true,
      reference: true,
      applicants: { where: { role: "PRIMARY" }, take: 1 },
    },
  });

  const amount = accountFeeFor(application.grantedAmount ?? application.amount);
  const fee = await db.accountFee.create({
    data: {
      applicationId,
      amount,
      currency: application.currency,
      reference: feeReference(),
      dueBy: addDays(new Date(), ACCOUNT_FEE.validDays),
    },
  });

  await recordAudit({
    applicationId,
    action: "account_fee_issued",
    actorType: "SYSTEM",
    payload: { amount, currency: fee.currency, reference: fee.reference, dueBy: fee.dueBy.toISOString() },
  });

  await transition(applicationId, "FEE_PENDING", "SYSTEM");

  const primary = application.applicants[0];
  if (primary?.email) {
    await notify({
      applicationId,
      channel: "EMAIL",
      to: primary.email,
      template: "account_fee_due",
      locale: application.locale as Locale,
      variables: { reference: application.reference, feeReference: fee.reference },
    });
  }

  return fee;
}

export async function accountFee(applicationId: string) {
  return db.accountFee.findUnique({ where: { applicationId } });
}

/**
 * Takes the fee payment.
 *
 * The provider is asked to charge against the fee's own reference, which is
 * what makes the call idempotent end to end: a borrower who submits the form
 * twice, or whose browser retries, settles once. A declined charge leaves the
 * fee PENDING and raises, so the page can say why and offer another attempt —
 * a decline is not a state the application should get stuck in.
 */
export async function payAccountFee(
  applicationId: string,
  options: { card: CardPayment; actorId?: string | null },
) {
  await assertConsents(applicationId, "ACCOUNT_FEE");

  const fee = await db.accountFee.findUnique({ where: { applicationId } });
  if (!fee) throw new FeeNotPayableError("NOT_ISSUED");
  if (fee.status === "PAID") return fee;
  if (fee.dueBy < new Date()) throw new FeeNotPayableError("EXPIRED");

  const registry = providers();
  const outcome = await registry.payments.charge(
    {
      applicationId,
      amount: fee.amount,
      currency: fee.currency,
      reference: fee.reference,
      // Straight through to the provider and nowhere else. Nothing below this
      // call sees a card number: only the brand and the last four come back.
      card: options.card,
    },
    { idempotencyKey: idempotencyKey("account-fee", fee.reference), attempt: 1 },
  );

  if (outcome.status !== "SETTLED") {
    await recordAudit({
      applicationId,
      action: "account_fee_declined",
      actorType: "SYSTEM",
      payload: { reference: fee.reference, declineCode: outcome.declineCode, method: FEE_CHARGE_METHOD },
    });
    throw new ChargeDeclinedError(outcome.declineCode ?? "unknown");
  }

  const paid = await db.accountFee.update({
    where: { id: fee.id },
    data: {
      status: "PAID",
      method: FEE_CHARGE_METHOD,
      cardBrand: outcome.brand,
      cardLast4: outcome.last4,
      providerReference: outcome.providerReference,
      paidAt: new Date(),
    },
  });

  await recordAudit({
    applicationId,
    action: "account_fee_paid",
    actorType: "CUSTOMER",
    actorId: options.actorId ?? null,
    payload: {
      reference: fee.reference,
      amount: fee.amount,
      currency: fee.currency,
      method: FEE_CHARGE_METHOD,
      cardLast4: outcome.last4,
      provider: registry.payments.name,
    },
  });

  await transition(applicationId, "FEE_PAID", "CUSTOMER", { actorId: options.actorId });
  return paid;
}

/**
 * Settles the fee on an administrator's word rather than on a charge.
 *
 * The borrower is told to contact us to pay, so nothing on the site can know
 * the money arrived — a person at this desk does, and this is where they say
 * so. Idempotent, like the card path: a fee already PAID is returned untouched
 * so a double-clicked button cannot re-date a settled fee.
 *
 * `dueBy` is deliberately not enforced here. It exists to expire an unanswered
 * payment request; a payment that actually reached us is not undone by having
 * taken a week, and refusing it would strand a file nobody can move.
 */
export async function confirmAccountFeePayment(
  applicationId: string,
  options: { agentId: string },
) {
  const fee = await db.accountFee.findUnique({ where: { applicationId } });
  if (!fee) throw new FeeNotPayableError("NOT_ISSUED");
  if (fee.status === "PAID") return fee;

  const paid = await db.accountFee.update({
    where: { id: fee.id },
    data: { status: "PAID", method: FEE_MANUAL_METHOD, paidAt: new Date() },
  });

  await recordAudit({
    applicationId,
    action: "account_fee_paid",
    actorType: "AGENT",
    actorId: options.agentId,
    payload: {
      reference: fee.reference,
      amount: fee.amount,
      currency: fee.currency,
      method: FEE_MANUAL_METHOD,
    },
  });

  await transition(applicationId, "FEE_PAID", "AGENT", { actorId: options.agentId });
  return paid;
}
