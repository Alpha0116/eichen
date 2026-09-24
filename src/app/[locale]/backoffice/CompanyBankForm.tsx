"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { CompanyBankAccount } from "@/server/services/companyBank";
import type { BackofficeState } from "./actions";

/**
 * The company's bank account, shown to borrowers on step 4 as where to send
 * the account fee.
 *
 * Opens on what is saved, or empty: there is no default to fall back on, and
 * an empty form is what keeps the fee page on "write to us for the details".
 * Removing the details is its own button, for the same reason.
 */
export function CompanyBankForm({
  dictionary,
  action,
  clearAction,
  account,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState, formData: FormData) => Promise<BackofficeState>;
  clearAction: () => Promise<void>;
  account: CompanyBankAccount | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.backoffice;
  const f = t.companyBankFields;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {state.error === "iban" ? (
          <Alert tone="danger">{dictionary.errors.ibanInvalid}</Alert>
        ) : state.error ? (
          <Alert tone="danger">{t.companyBankInvalid}</Alert>
        ) : null}
        {state.ok ? <Alert tone="positive">{t.companyBankSaved}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={f.accountHolder} htmlFor="cb-accountHolder" required>
            <Input
              id="cb-accountHolder"
              name="accountHolder"
              defaultValue={account?.accountHolder ?? ""}
              placeholder="Eichen GmbH"
              required
              maxLength={80}
            />
          </Field>
          <Field label={f.bankName} htmlFor="cb-bankName" required>
            <Input
              id="cb-bankName"
              name="bankName"
              defaultValue={account?.bankName ?? ""}
              placeholder="Commerzbank"
              required
              maxLength={80}
            />
          </Field>
          <Field label={f.iban} htmlFor="cb-iban" required>
            <Input
              id="cb-iban"
              name="iban"
              defaultValue={account?.iban ?? ""}
              placeholder="DE89 3704 0044 0532 0130 00"
              required
              maxLength={42}
              className="tabular"
            />
          </Field>
          <Field label={f.bic} htmlFor="cb-bic" required>
            <Input
              id="cb-bic"
              name="bic"
              defaultValue={account?.bic ?? ""}
              placeholder="COBADEFFXXX"
              required
              maxLength={11}
              className="tabular"
            />
          </Field>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? dictionary.common.loading : t.companyBankSave}
        </Button>
      </form>

      {account ? (
        <form action={clearAction}>
          <Button type="submit" size="sm" variant="ghost">
            {t.companyBankClear}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
