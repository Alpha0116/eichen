"use client";

import { useActionState, useRef } from "react";
import { Field } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { ActionState } from "../../actions";

/**
 * One document, uploaded the moment it is chosen.
 *
 * There is no send button. Picking a file in the dialogue is already the
 * decision to hand it over — asking for a second, separate confirmation on
 * every one of five documents is five extra clicks that decide nothing, and a
 * borrower who chooses a file and walks away believing it was sent is a file
 * that never arrives.
 *
 * The input is disabled while the upload runs, so a second file cannot be
 * chosen into a form that is already submitting the first.
 */
export function UploadForm({
  kind,
  dictionary,
  action,
  label,
}: {
  kind: string;
  label: string;
  dictionary: Dictionary;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  const errorMessage =
    state.error === "fileTooLarge"
      ? dictionary.errors.fileTooLarge
      : state.error === "fileType"
        ? dictionary.errors.fileType
        : state.error === "malware"
          ? dictionary.errors.generic
          : state.error === "required"
            ? dictionary.errors.required
            : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <Field label={label} htmlFor={`file-${kind}`} error={errorMessage}>
        <input
          id={`file-${kind}`}
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          disabled={pending}
          // `requestSubmit` rather than `submit`: it runs the form's own
          // submission path, which is what React's action is attached to.
          onChange={(event) => {
            if (event.target.files?.length) formRef.current?.requestSubmit();
          }}
          className="block w-full text-sm file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--border-strong)] file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-sm disabled:opacity-60"
        />
      </Field>
      {pending ? (
        <p className="text-xs text-[var(--muted)]" role="status">
          {dictionary.common.loading}
        </p>
      ) : null}
    </form>
  );
}
