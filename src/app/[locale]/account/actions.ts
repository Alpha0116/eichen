"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { revokeConsent } from "@/server/services/consent";
import { acceptSettlement, quoteSettlement } from "@/server/services/servicing";
import type { ConsentPurpose } from "@/domain/compliance/consents";

function safeLocale(value: string): string {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Every loan action re-checks that the loan belongs to the signed-in user.
 * The loan id in the URL is an identifier, never an authorisation.
 */
async function ownedLoan(locale: string, loanId: string) {
  const user = await requireUser(locale);
  const loan = await db.loan.findFirst({
    where: { id: loanId, application: { userId: user.id } },
    include: { application: true },
  });
  if (!loan) redirect(`/${locale}/account`);
  return { user, loan };
}

export async function quoteSettlementAction(
  localeParam: string,
  loanId: string,
): Promise<void> {
  const locale = safeLocale(localeParam);
  await ownedLoan(locale, loanId);
  await quoteSettlement(loanId, new Date());
  revalidatePath(`/${locale}/account/loan/${loanId}`);
}

export async function acceptSettlementAction(
  localeParam: string,
  loanId: string,
  quoteId: string,
): Promise<void> {
  const locale = safeLocale(localeParam);
  await ownedLoan(locale, loanId);

  const quote = await db.settlementQuote.findFirst({ where: { id: quoteId, loanId } });
  if (!quote) redirect(`/${locale}/account/loan/${loanId}`);

  await acceptSettlement(quoteId);
  revalidatePath(`/${locale}/account/loan/${loanId}`);
}

/**
 * Turning off the direct debit does not cancel the debt, and the interface
 * says so — the borrower simply pays by transfer instead.
 */
export async function toggleAutopayAction(
  localeParam: string,
  loanId: string,
): Promise<void> {
  const locale = safeLocale(localeParam);
  const { loan } = await ownedLoan(locale, loanId);

  await db.loan.update({
    where: { id: loanId },
    data: { autopayEnabled: !loan.autopayEnabled },
  });

  if (loan.autopayEnabled) {
    await revokeConsent("SEPA_MANDATE", { applicationId: loan.applicationId });
  }
  revalidatePath(`/${locale}/account/loan/${loanId}`);
}

export async function revokeConsentAction(
  localeParam: string,
  applicationId: string,
  purpose: string,
): Promise<void> {
  const locale = safeLocale(localeParam);
  const user = await requireUser(locale);

  const application = await db.application.findFirst({
    where: { id: applicationId, userId: user.id },
  });
  if (!application) redirect(`/${locale}/account`);

  await revokeConsent(purpose as ConsentPurpose, { applicationId, userId: user.id });
  revalidatePath(`/${locale}/account`);
}
