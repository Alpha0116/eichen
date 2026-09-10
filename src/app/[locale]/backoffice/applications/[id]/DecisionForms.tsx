"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { BackofficeState } from "../../actions";

export function OverrideForm({
  dictionary,
  action,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState, formData: FormData) => Promise<BackofficeState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{t.overrideReasonHint}</Alert> : null}
      <Field label={t.overrideReason} htmlFor="reason" hint={t.overrideReasonHint} required>
        <Textarea id="reason" name="reason" rows={3} required minLength={10} aria-describedby="reason-hint" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="outcome" value="ACCEPT" size="sm" disabled={pending}>
          {t.overrideApprove}
        </Button>
        <Button type="submit" name="outcome" value="DECLINE" size="sm" variant="danger" disabled={pending}>
          {t.overrideDecline}
        </Button>
      </div>
    </form>
  );
}

/**
 * The decision itself: approve, approve for less, or refuse.
 *
 * Approving also generates the contract, so this form is the single moment a
 * person commits the platform to anything. Leaving the amount blank grants
 * what was asked for.
 */
export function FinaliseForm({
  dictionary,
  action,
  requestedAmount,
  outstandingDocuments,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState, formData: FormData) => Promise<BackofficeState>;
  /** In euros, as a placeholder, so "blank means as requested" is visible. */
  requestedAmount: string;
  /** Document kinds still to review. Approval is refused while any remain. */
  outstandingDocuments: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;
  const kinds = dictionary.documents.kinds as Record<string, string>;
  // Known before the click, not discovered by it: an approve button that
  // always fails on this file is worse than one that says why up front.
  const blocked = outstandingDocuments.length > 0;
  const missing = state.error === "documentsIncomplete" ? (state.details ?? []) : outstandingDocuments;

  return (
    <form action={formAction} className="space-y-3">
      {blocked || state.error === "documentsIncomplete" ? (
        <Alert tone="warning" title={t.approveBlockedTitle}>
          <p>{t.approveBlockedBody}</p>
          <ul className="mt-2 list-inside list-disc">
            {missing.map((kind) => (
              <li key={kind}>{kinds[kind] ?? kind}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {state.error && state.error !== "documentsIncomplete" ? (
        <Alert tone="danger">{dictionary.errors.generic}</Alert>
      ) : null}
      <Field
        label={t.grantedAmount}
        htmlFor="grantedAmount"
        hint={t.grantedAmountHint}
        optionalLabel={dictionary.common.optional}
      >
        <Input id="grantedAmount" name="grantedAmount" inputMode="decimal" placeholder={requestedAmount} />
      </Field>
      <Field label={t.overrideReason} htmlFor="finalReason" optionalLabel={dictionary.common.optional}>
        <Input id="finalReason" name="reason" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="outcome"
          value="APPROVED"
          size="sm"
          disabled={pending || blocked}
        >
          {t.approveAndIssueContract}
        </Button>
        <Button type="submit" name="outcome" value="DECLINED" size="sm" variant="danger" disabled={pending}>
          {dictionary.applicationStatus.DECLINED}
        </Button>
      </div>
    </form>
  );
}

/**
 * Sending the file back instead of deciding it. Separate form and separate
 * button: a "return" tucked inside the decision form would be one mis-click
 * away from a refusal.
 */
export function ReturnForm({
  dictionary,
  action,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState, formData: FormData) => Promise<BackofficeState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{t.returnReasonHint}</Alert> : null}
      <Field label={t.returnReason} htmlFor="returnReason" hint={t.returnReasonHint} required>
        <Textarea id="returnReason" name="reason" rows={2} required minLength={10} />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {t.returnToCustomer}
      </Button>
    </form>
  );
}

/**
 * Confirms the fee arrived, which is what releases the file to the payout.
 *
 * The amount and the reference are printed next to the button so the person
 * pressing it can match them against whatever they are looking at — a bank
 * statement, a transfer receipt — rather than trusting the file id alone.
 */
export function ConfirmFeeForm({
  dictionary,
  action,
  amount,
  reference,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState) => Promise<BackofficeState>;
  amount: string;
  reference: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="positive">{t.confirmFeeDone}</Alert> : null}
      <p className="text-sm leading-relaxed text-[var(--muted)]">{t.confirmFeeIntro}</p>
      <p className="text-sm">
        <span className="text-[var(--muted)]">{t.confirmFeeAmount}</span>{" "}
        <span className="tabular font-medium">{amount}</span>
      </p>
      <p className="text-sm">
        <span className="text-[var(--muted)]">{t.confirmFeeReference}</span>{" "}
        <span className="tabular font-medium">{reference}</span>
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? dictionary.common.loading : t.confirmFee}
      </Button>
    </form>
  );
}

export function DisburseForm({
  dictionary,
  action,
  maskedIban,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState) => Promise<BackofficeState>;
  maskedIban: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="positive">{t.disburseDone}</Alert> : null}
      {/* Says what the button does before it is pressed. This is the step the
          borrower is watching a progress bar for, and it cannot be undone. */}
      <p className="text-sm leading-relaxed text-[var(--muted)]">{t.disburseIntro}</p>
      {/* The destination is shown, not asked for: it is the account already on
          the file, and an administrator reading it back is a check. */}
      <p className="text-sm">
        <span className="text-[var(--muted)]">{t.payoutAccount}</span>{" "}
        <span className="tabular font-medium">{maskedIban ?? t.payoutAccountMissing}</span>
      </p>
      <Button type="submit" size="sm" disabled={pending || !maskedIban}>
        {pending ? dictionary.common.loading : t.disburse}
      </Button>
    </form>
  );
}
