import { randomInt } from "node:crypto";
import { recordAudit } from "../audit";
import { db } from "../db";
import { formatIban, ibanFrom, maskIban } from "./iban";

/**
 * The account space on step 5: the granted amount shown as the balance of an
 * account, with a card and an IBAN of the borrower's own.
 *
 * Moving the money out of it takes a confirmation code the borrower does not
 * receive on their own. They ask for it by email, support reads it off the
 * file in the back office, and the flow is allowed to stop at that request.
 */

/**
 * What every account space shares. Fixed rather than configured: the bank
 * details an administrator enters are the company's own, for the fee, and
 * have no place on a borrower's card.
 */
export const ACCOUNT_SPACE = {
  bankName: "Eichen Bank",
  bic: "COBADEFFXXX",
  cardExpiry: "12/29",
  /** First six digits of every borrower's card. */
  cardPrefix: "535508",
  /** Bank code inside every borrower's IBAN. */
  bankCode: "37040044",
} as const;

/** Wrong codes allowed before the form closes and only support can help. */
export const TRANSFER_CODE_MAX_ATTEMPTS = 5;

/** A borrower's own numbers on the account space. */
export interface ClientAccount {
  cardNumber: string;
  iban: string;
}

/** Digits, in groups of four. */
export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** The Luhn check digit that makes `body` a valid card number. */
function luhnDigit(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    let digit = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return String((10 - (sum % 10)) % 10);
}

function randomDigits(count: number): string {
  let out = "";
  for (let i = 0; i < count; i += 1) out += String(randomInt(0, 10));
  return out;
}

/**
 * A card number and IBAN of the borrower's own, on the account space's bank.
 * Both carry valid check digits — Luhn for the card, ISO 13616 for the IBAN
 * (DE, check digits, eight-digit bank code, ten-digit account) — so neither
 * looks made up next to a real one.
 */
export function newClientAccount(): ClientAccount {
  const body = ACCOUNT_SPACE.cardPrefix + randomDigits(9);
  const cardNumber = formatCardNumber(body + luhnDigit(body));
  const iban = formatIban(ibanFrom("DE", ACCOUNT_SPACE.bankCode + randomDigits(10)));
  return { cardNumber, iban };
}

/**
 * The borrower's card number and IBAN, made the first time the account space
 * is shown and kept from then on: a new client never changes the numbers
 * someone has already seen.
 */
export async function clientAccountFor(applicationId: string): Promise<ClientAccount> {
  const current = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { accountCardNumber: true, accountIban: true },
  });
  if (current.accountCardNumber && current.accountIban) {
    return { cardNumber: current.accountCardNumber, iban: current.accountIban };
  }

  const fresh = newClientAccount();
  // Conditional, like the transfer code: two first views at once keep one set.
  await db.application.updateMany({
    where: { id: applicationId, accountCardNumber: null },
    data: { accountCardNumber: fresh.cardNumber },
  });
  await db.application.updateMany({
    where: { id: applicationId, accountIban: null },
    data: { accountIban: fresh.iban },
  });
  const settled = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { accountCardNumber: true, accountIban: true },
  });
  return {
    cardNumber: settled.accountCardNumber ?? fresh.cardNumber,
    iban: settled.accountIban ?? fresh.iban,
  };
}

export class ClientAccountInvalid extends Error {
  constructor(public readonly field: "cardNumber" | "iban") {
    super(`Invalid ${field}`);
    this.name = "ClientAccountInvalid";
  }
}

/** An administrator correcting one borrower's numbers by hand. */
export async function saveClientAccount(
  applicationId: string,
  account: ClientAccount,
  options: { agentId: string },
): Promise<void> {
  const card = account.cardNumber.replace(/\D/g, "");
  if (card.length < 12 || card.length > 19) throw new ClientAccountInvalid("cardNumber");
  if (!maskIban(account.iban)) throw new ClientAccountInvalid("iban");

  await db.application.update({
    where: { id: applicationId },
    data: { accountCardNumber: formatCardNumber(card), accountIban: formatIban(account.iban) },
  });
  await recordAudit({
    applicationId,
    action: "account_space_updated",
    actorType: "AGENT",
    actorId: options.agentId,
    payload: { fields: ["cardNumber", "iban"] },
  });
}

/**
 * The file's transfer code, created the first time anyone needs it — the
 * borrower opening step 5, or support opening the file to read it out.
 *
 * Six digits from a CSPRNG. The conditional update means two first views at
 * once settle on a single code instead of the second overwriting the first.
 */
export async function transferCodeFor(applicationId: string): Promise<string> {
  const current = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { transferCode: true },
  });
  if (current.transferCode) return current.transferCode;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.application.updateMany({
    where: { id: applicationId, transferCode: null },
    data: { transferCode: code },
  });
  const settled = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { transferCode: true },
  });
  return settled.transferCode ?? code;
}

export type TransferOutcome = "REQUESTED" | "INVALID" | "LOCKED";

/**
 * Checks the code the borrower typed and, when it matches, records the
 * transfer as requested. Nothing is paid out from here: the request is what
 * support acts on.
 */
export async function requestTransfer(
  applicationId: string,
  options: { code: string; userId: string | null },
): Promise<TransferOutcome> {
  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { transferCodeAttempts: true, transferRequestedAt: true },
  });
  if (application.transferRequestedAt) return "REQUESTED";
  if (application.transferCodeAttempts >= TRANSFER_CODE_MAX_ATTEMPTS) return "LOCKED";

  const expected = await transferCodeFor(applicationId);
  if (options.code.replace(/\s/g, "") !== expected) {
    const updated = await db.application.update({
      where: { id: applicationId },
      data: { transferCodeAttempts: { increment: 1 } },
      select: { transferCodeAttempts: true },
    });
    return updated.transferCodeAttempts >= TRANSFER_CODE_MAX_ATTEMPTS ? "LOCKED" : "INVALID";
  }

  await db.application.update({
    where: { id: applicationId },
    data: { transferRequestedAt: new Date() },
  });
  await recordAudit({
    applicationId,
    action: "transfer_requested",
    actorType: "CUSTOMER",
    actorId: options.userId,
  });
  return "REQUESTED";
}

/** Lets the borrower try again after a lockout, from the back office. */
export async function resetTransferAttempts(
  applicationId: string,
  options: { agentId: string },
): Promise<void> {
  await db.application.update({
    where: { id: applicationId },
    data: { transferCodeAttempts: 0 },
  });
  await recordAudit({
    applicationId,
    action: "transfer_attempts_reset",
    actorType: "AGENT",
    actorId: options.agentId,
  });
}
