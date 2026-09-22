"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { requireStaff } from "@/server/access";
import { db } from "@/server/db";
import { RuleSetValidationError } from "@/domain/rules/engine";
import type { RuleSet } from "@/domain/rules/types";
import {
  deleteApplication,
  finaliseDecision,
  ReasonRequired,
  returnForCorrection,
} from "@/server/services/backoffice";
import { confirmAccountFeePayment, FeeNotPayableError } from "@/server/services/accountFee";
import { reviewDocument, type RejectionCode } from "@/server/services/documents";
import { publishRuleSet } from "@/server/services/rules";
import { disburse } from "@/server/services/servicing";

export type BackofficeState = { error?: string; ok?: boolean; details?: string[] };

function safeLocale(value: string): string {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function reviewDocumentAction(
  localeParam: string,
  applicationId: string,
  formData: FormData,
): Promise<void> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);

  const documentId = String(formData.get("documentId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "VALIDATED" | "REJECTED";
  const rejectionCode = (formData.get("rejectionCode") as RejectionCode | null) ?? undefined;

  await reviewDocument({
    documentId,
    agentId: agent.id,
    decision,
    rejectionCode: decision === "REJECTED" ? (rejectionCode ?? "unreadable") : undefined,
  });

  revalidatePath(`/${locale}/backoffice/applications/${applicationId}`);
}

export async function finaliseDecisionAction(
  localeParam: string,
  applicationId: string,
  _previous: BackofficeState,
  formData: FormData,
): Promise<BackofficeState> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);

  const outcome = String(formData.get("outcome") ?? "") as "APPROVED" | "DECLINED";
  const reason = String(formData.get("reason") ?? "") || undefined;

  // Blank means "as requested". A granted amount is in euros on the form and
  // cents everywhere below, converted here at the single boundary.
  const grantedRaw = String(formData.get("grantedAmount") ?? "").trim();
  const grantedAmount =
    grantedRaw === ""
      ? null
      : Math.round(Number(grantedRaw.replace(/\s/g, "").replace(",", ".")) * 100);
  if (grantedAmount !== null && (!Number.isFinite(grantedAmount) || grantedAmount <= 0)) {
    return { error: "grantedAmountInvalid" };
  }

  try {
    await finaliseDecision(applicationId, { agentId: agent.id, outcome, reason, grantedAmount });
  } catch {
    return { error: "generic" };
  }

  revalidatePath(`/${locale}/backoffice/applications/${applicationId}`);
  return { ok: true };
}

/**
 * Sends a submitted file back for correction rather than refusing it.
 *
 * The reason is shown to the borrower, so it must say what to fix; the same
 * ten-character floor as an override applies, because "incomplete" is not an
 * instruction anyone can act on.
 */
export async function returnApplicationAction(
  localeParam: string,
  applicationId: string,
  _previous: BackofficeState,
  formData: FormData,
): Promise<BackofficeState> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);

  try {
    await returnForCorrection(applicationId, {
      agentId: agent.id,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (error) {
    if (error instanceof ReasonRequired) return { error: "reasonRequired" };
    throw error;
  }

  revalidatePath(`/${locale}/backoffice/applications/${applicationId}`);
  return { ok: true };
}

/**
 * Marks the account fee as received.
 *
 * The borrower is asked to arrange the payment with support, so this desk is
 * the only place that knows it arrived. It is the gate in front of the payout:
 * the file stays on step 4 until an administrator presses this.
 */
export async function confirmFeePaymentAction(
  localeParam: string,
  applicationId: string,
  _previous: BackofficeState,
): Promise<BackofficeState> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);

  try {
    await confirmAccountFeePayment(applicationId, { agentId: agent.id });
  } catch (error) {
    if (error instanceof FeeNotPayableError) return { error: `fee${error.code}` };
    return { error: "generic" };
  }

  revalidatePath(`/${locale}/backoffice/applications/${applicationId}`);
  return { ok: true };
}

export async function disburseAction(
  localeParam: string,
  applicationId: string,
  _previous: BackofficeState,
): Promise<BackofficeState> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);

  // No account number is asked for here. The payout goes to the account the
  // borrower gave with their file; a second one typed at this desk would be
  // an account nobody checked against anything.
  try {
    await disburse(applicationId, { agentId: agent.id });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "generic" };
  }

  revalidatePath(`/${locale}/backoffice/applications/${applicationId}`);
  return { ok: true };
}

export async function toggleLenderAction(
  localeParam: string,
  productId: string,
): Promise<void> {
  const locale = safeLocale(localeParam);
  await requireStaff(locale);

  const product = await db.lenderProductRecord.findUniqueOrThrow({ where: { id: productId } });
  await db.lenderProductRecord.update({
    where: { id: productId },
    data: { active: !product.active },
  });
  revalidatePath(`/${locale}/backoffice/lenders`);
}

const publishSchema = z.object({
  payload: z.string().min(2).max(200_000),
  note: z.string().max(500).optional(),
});

/**
 * Publishes an edited rule set as a new version.
 *
 * The payload is parsed and structurally validated before anything is written.
 * A rule set is configuration that decides whether people get credit, so a
 * malformed one has to be rejected at the door rather than discovered by an
 * applicant.
 */
export async function publishRuleSetAction(
  localeParam: string,
  _previous: BackofficeState,
  formData: FormData,
): Promise<BackofficeState> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);
  if (agent.role !== "ADMIN" && agent.role !== "RISK") return { error: "forbidden" };

  const parsed = publishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "validation" };

  let ruleSet: RuleSet;
  try {
    ruleSet = JSON.parse(parsed.data.payload) as RuleSet;
  } catch {
    return { error: "invalidJson" };
  }

  try {
    await publishRuleSet({ ruleSet, note: parsed.data.note, publishedBy: agent.id });
  } catch (error) {
    if (error instanceof RuleSetValidationError) {
      return { error: "ruleSetInvalid", details: error.issues };
    }
    throw error;
  }

  revalidatePath(`/${locale}/backoffice/rules`);
  return { ok: true };
}

/**
 * Erases an application, with everything attached to it.
 *
 * Irreversible, so it is its own action with its own button rather than a
 * value on a form that decides other things, and the queue is what the agent
 * is returned to — the page they were on no longer exists.
 */
export async function deleteApplicationAction(
  localeParam: string,
  applicationId: string,
): Promise<void> {
  const locale = safeLocale(localeParam);
  const agent = await requireStaff(locale);

  await deleteApplication(applicationId, { agentId: agent.id });

  revalidatePath(`/${locale}/backoffice`);
  redirect(`/${locale}/backoffice`);
}
