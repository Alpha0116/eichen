"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { MailIcon } from "@/components/icons";
import type { Dictionary } from "@/i18n";
import { interpolate } from "@/i18n";
import type { ActionState } from "../../actions";

/**
 * The code that releases a transfer out of the account space.
 *
 * The code is not sent on its own: the link beside the field opens an email
 * to support with the reference already in the subject, and support reads the
 * code off the file. A borrower who never writes stays here, which is fine.
 */
export function TransferForm({
  dictionary,
  action,
  reference,
  requestCodeHref,
  locked,
}: {
  dictionary: Dictionary;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  reference: string;
  requestCodeHref: string;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.funnel.processing;
  const errors = dictionary.errors as Record<string, string>;
  const closed = locked || state.error === "transferCodeLocked";

  return (
    <form action={formAction} className="space-y-4">
      {closed ? (
        <Alert tone="danger">{dictionary.errors.transferCodeLocked}</Alert>
      ) : state.error && state.field !== "code" ? (
        <Alert tone="danger">{errors[state.error] ?? dictionary.errors.generic}</Alert>
      ) : null}

      <Field
        label={t.code}
        htmlFor="transferCode"
        hint={interpolate(t.codeHint, { reference })}
        error={state.field === "code" && state.error ? errors[state.error] : undefined}
        required
      >
        <Input
          id="transferCode"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          placeholder={t.codePlaceholder}
          aria-describedby="transferCode-hint"
          disabled={closed}
          required
          className="tabular max-w-[12rem] tracking-[0.3em]"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || closed}>
          {pending ? dictionary.common.loading : t.confirm}
        </Button>
        <a
          href={requestCodeHref}
          className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-2"
        >
          <MailIcon className="h-4 w-4" />
          {t.requestCode}
        </a>
      </div>
    </form>
  );
}
