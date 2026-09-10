"use client";

import { useActionState } from "react";
import { Button, Field } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { ActionState } from "../../actions";

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
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="kind" value={kind} />
      <Field label={label} htmlFor={`file-${kind}`} error={errorMessage}>
        <input
          id={`file-${kind}`}
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          className="block w-full text-sm file:mr-3 file:rounded-[var(--radius)] file:border file:border-[var(--border-strong)] file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-sm"
        />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? dictionary.common.loading : dictionary.common.upload}
      </Button>
    </form>
  );
}
