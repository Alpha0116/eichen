"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { BackofficeState } from "../actions";

/**
 * Rule-set editor.
 *
 * The set is edited as its own JSON rather than through a generated form: the
 * condition language is a small tree, and a form that could express all of it
 * would be harder to review than the document itself. Publishing validates the
 * structure and every fact name server-side before a version is created, so a
 * malformed set cannot reach an applicant.
 */
export function RuleSetEditor({
  dictionary,
  action,
  initialPayload,
}: {
  dictionary: Dictionary;
  action: (previous: BackofficeState, formData: FormData) => Promise<BackofficeState>;
  initialPayload: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [payload, setPayload] = useState(initialPayload);
  const t = dictionary.backoffice;

  return (
    <form action={formAction} className="space-y-4">
      {state.ok ? <Alert tone="positive">{t.publish}</Alert> : null}
      {state.error ? (
        <Alert tone="danger" title={dictionary.errors.validation}>
          {state.details ? (
            <ul className="list-disc space-y-1 pl-5 text-xs">
              {state.details.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p>{state.error}</p>
          )}
        </Alert>
      ) : null}

      <Field label={t.newVersion} htmlFor="note" optionalLabel={dictionary.common.optional}>
        <Input id="note" name="note" maxLength={500} />
      </Field>

      <Field label={t.rulesTitle} htmlFor="payload" required>
        <Textarea
          id="payload"
          name="payload"
          rows={22}
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          spellCheck={false}
          className="font-mono text-xs"
          required
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? dictionary.common.loading : t.publish}
      </Button>
    </form>
  );
}
