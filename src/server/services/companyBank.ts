import { recordAudit } from "../audit";
import { db } from "../db";
import { formatIban, maskIban } from "./iban";

/**
 * The company's bank account, which the account fee is transferred to.
 *
 * Entered by an administrator in the back office and shown on step 4. There
 * is no default: an account number a borrower might pay into must be one
 * somebody actually typed, so until it is saved the fee page sends the
 * borrower to support for the details instead.
 */

export interface CompanyBankAccount {
  accountHolder: string;
  bankName: string;
  iban: string;
  bic: string;
}

const ROW_ID = "default";

export async function companyBankAccount(): Promise<CompanyBankAccount | null> {
  const row = await db.companyBankAccount.findUnique({ where: { id: ROW_ID } });
  if (!row) return null;
  return { accountHolder: row.accountHolder, bankName: row.bankName, iban: row.iban, bic: row.bic };
}

export class CompanyIbanInvalid extends Error {
  constructor() {
    super("Invalid company IBAN");
    this.name = "CompanyIbanInvalid";
  }
}

export async function saveCompanyBankAccount(
  account: CompanyBankAccount,
  options: { agentId: string },
): Promise<void> {
  // Checked, because borrowers will pay into it: a typo here is money sent
  // to an account nobody at the company can see.
  if (!maskIban(account.iban)) throw new CompanyIbanInvalid();
  const data = { ...account, iban: formatIban(account.iban), bic: account.bic.toUpperCase() };

  await db.companyBankAccount.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...data, updatedBy: options.agentId },
    update: { ...data, updatedBy: options.agentId },
  });
  // Field names only: the trail never holds an IBAN.
  await recordAudit({
    applicationId: null,
    action: "company_bank_updated",
    actorType: "AGENT",
    actorId: options.agentId,
    payload: { fields: Object.keys(account) },
  });
}

/** Takes the details down, which puts the fee page back to "write to us". */
export async function clearCompanyBankAccount(options: { agentId: string }): Promise<void> {
  await db.companyBankAccount.deleteMany({ where: { id: ROW_ID } });
  await recordAudit({
    applicationId: null,
    action: "company_bank_updated",
    actorType: "AGENT",
    actorId: options.agentId,
    payload: { cleared: true },
  });
}
