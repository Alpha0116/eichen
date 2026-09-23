import { randomInt } from "node:crypto";
import { recordAudit } from "../audit";
import { db } from "../db";

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
