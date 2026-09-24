import { randomInt } from "node:crypto";
import { recordAudit } from "../audit";
import { db } from "../db";
import { formatIban, ibanFrom, maskIban, normaliseIban } from "./iban";

/**
 * The account space on step 5: the granted amount shown as the balance of an
 * account, on a card carrying the bank details an administrator set.
 *
 * Moving the money out of it takes a confirmation code the borrower does not
 * receive on their own. They ask for it by email, support reads it off the
 * file in the back office, and the flow is allowed to stop at that request.
 */

export interface AccountSpaceDetails {
  bankName: string;
  /** Blank means the borrower's own name goes on the card. */
  accountHolder: string;
  iban: string;
  bic: string;
  cardNumber: string;
  cardExpiry: string;
}

/** What the space shows until an administrator saves details of their own. */
export const DEFAULT_ACCOUNT_SPACE: AccountSpaceDetails = {
  bankName: "Eichen Bank",
  accountHolder: "",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
  cardNumber: "5355 0812 3456 7890",
  cardExpiry: "12/29",
};

const SETTINGS_ID = "default";

/** A borrower's own numbers on the account space. */
export interface ClientAccount {
  cardNumber: string;
  iban: string;
}

/** Card prefix and bank code used when the saved ones cannot be read. */
const FALLBACK_CARD_PREFIX = "535508";
const FALLBACK_BANK_CODE = "37040044";

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
 * A number of the borrower's own, on the same bank as the saved details: the
 * card keeps the saved card's first six digits, the IBAN its bank code. Both
 * carry valid check digits, so neither looks made up next to a real one.
 */
export function newClientAccount(details: AccountSpaceDetails): ClientAccount {
  const savedCard = details.cardNumber.replace(/\D/g, "");
  const prefix = savedCard.length >= 12 ? savedCard.slice(0, 6) : FALLBACK_CARD_PREFIX;
  const body = prefix + randomDigits(9);
  const cardNumber = formatCardNumber(body + luhnDigit(body));

  // A German IBAN is DE, two check digits, an eight-digit bank code and a
  // ten-digit account number. Anything else saved falls back to the default
  // bank rather than producing an IBAN of the wrong shape.
  const savedIban = normaliseIban(details.iban);
  const bankCode = /^DE\d{20}$/.test(savedIban) ? savedIban.slice(4, 12) : FALLBACK_BANK_CODE;
  const iban = formatIban(ibanFrom("DE", bankCode + randomDigits(10)));

  return { cardNumber, iban };
}

/**
 * The borrower's card number and IBAN, made the first time the account space
 * is shown and kept from then on — a new client, or new bank details saved in
 * the back office, never changes the numbers someone has already seen.
 */
export async function clientAccountFor(
  applicationId: string,
  details: AccountSpaceDetails,
): Promise<ClientAccount> {
  const current = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { accountCardNumber: true, accountIban: true },
  });
  if (current.accountCardNumber && current.accountIban) {
    return { cardNumber: current.accountCardNumber, iban: current.accountIban };
  }

  const fresh = newClientAccount(details);
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

/** Wrong codes allowed before the form closes and only support can help. */
export const TRANSFER_CODE_MAX_ATTEMPTS = 5;

export async function accountSpaceDetails(): Promise<AccountSpaceDetails> {
  const row = await db.accountSpaceSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) return DEFAULT_ACCOUNT_SPACE;
  return {
    bankName: row.bankName,
    accountHolder: row.accountHolder,
    iban: row.iban,
    bic: row.bic,
    cardNumber: row.cardNumber,
    cardExpiry: row.cardExpiry,
  };
}

export async function saveAccountSpaceDetails(
  details: AccountSpaceDetails,
  options: { agentId: string },
): Promise<void> {
  await db.accountSpaceSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...details, updatedBy: options.agentId },
    update: { ...details, updatedBy: options.agentId },
  });
  // Field names only: the values are bank details, which the trail never holds.
  await recordAudit({
    applicationId: null,
    action: "account_space_updated",
    actorType: "AGENT",
    actorId: options.agentId,
    payload: { fields: Object.keys(details) },
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
