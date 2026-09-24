"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { AccountSpaceDetails } from "@/server/services/accountSpace";
import type { BackofficeState } from "./actions";

/**
 * The bank details printed on every borrower's account space on step 5.
 *
 * Opens on what is showing now — the saved details, or the defaults — so
 * editing one field never means retyping the others.
 */
export function AccountSpaceForm({
  dictionary,
  action,
  details,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState, formData: FormData) => Promise<BackofficeState>;
  details: AccountSpaceDetails;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;
  const f = t.accountSpaceFields;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{t.accountSpaceInvalid}</Alert> : null}
      {state.ok ? <Alert tone="positive">{t.accountSpaceSaved}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.bankName} htmlFor="as-bankName" required>
          <Input id="as-bankName" name="bankName" defaultValue={details.bankName} required maxLength={80} />
        </Field>
        <Field
          label={f.accountHolder}
          htmlFor="as-accountHolder"
          hint={t.accountHolderHint}
          optionalLabel={dictionary.common.optional}
        >
          <Input id="as-accountHolder" name="accountHolder" defaultValue={details.accountHolder} maxLength={80} />
        </Field>
        <Field label={f.iban} htmlFor="as-iban" hint={t.ibanHint} required>
          <Input id="as-iban" name="iban" defaultValue={details.iban} required maxLength={42} className="tabular" />
        </Field>
        <Field label={f.bic} htmlFor="as-bic" required>
          <Input id="as-bic" name="bic" defaultValue={details.bic} required maxLength={11} className="tabular" />
        </Field>
        <Field label={f.cardNumber} htmlFor="as-cardNumber" hint={t.cardNumberHint} required>
          <Input
            id="as-cardNumber"
            name="cardNumber"
            defaultValue={details.cardNumber}
            inputMode="numeric"
            required
            maxLength={23}
            className="tabular"
          />
        </Field>
        <Field label={f.cardExpiry} htmlFor="as-cardExpiry" required>
          <Input
            id="as-cardExpiry"
            name="cardExpiry"
            defaultValue={details.cardExpiry}
            placeholder="12/29"
            required
            pattern="(0[1-9]|1[0-2])/[0-9]{2}"
            maxLength={5}
            className="tabular"
          />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? dictionary.common.loading : t.accountSpaceSave}
      </Button>
    </form>
  );
}
