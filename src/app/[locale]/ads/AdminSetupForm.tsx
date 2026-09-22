"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Field, Input, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import { interpolate } from "@/i18n";
import type { AdminSetupError } from "@/server/services/adminSetup";
import type { AdminSetupState } from "./actions";

function errorMessage(dictionary: Dictionary, error: AdminSetupError | undefined): string | null {
  switch (error) {
    case "passwordMismatch":
      return dictionary.auth.passwordMismatch;
    case "emailTaken":
      return dictionary.auth.emailTaken;
    case "passwordTooShort":
    case "passwordTooCommon":
      return dictionary.auth.passwordHint;
    case "tooManyRequests":
      return dictionary.adminSetup.tooManyRequests;
    case "codeInvalid":
      return dictionary.adminSetup.codeInvalid;
    case "codeExpired":
      return dictionary.adminSetup.codeExpired;
    case "bootstrapKeyInvalid":
      return dictionary.adminSetup.bootstrapKeyInvalid;
    case "bootstrapClosed":
      return dictionary.adminSetup.bootstrapClosed;
    case "validation":
      return dictionary.errors.validation;
    default:
      return null;
  }
}

/**
 * Two forms behind one state: describe the account, then type the code that
 * reached the operations mailbox. Which one shows is the server's decision,
 * carried in the action state, so a refresh or a wrong code never strands the
 * visitor on a step the server no longer expects.
 */
export function AdminSetupForm({
  dictionary,
  locale,
  minutes,
  requestAction,
  confirmAction,
}: {
  dictionary: Dictionary;
  locale: string;
  minutes: number;
  requestAction: (previous: AdminSetupState, formData: FormData) => Promise<AdminSetupState>;
  confirmAction: (previous: AdminSetupState, formData: FormData) => Promise<AdminSetupState>;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: AdminSetupState, formData: FormData) =>
      previous.step === "confirm" ? confirmAction(previous, formData) : requestAction(previous, formData),
    { step: "request" } as AdminSetupState,
  );
  const t = dictionary.adminSetup;
  const message = state.step === "done" ? null : errorMessage(dictionary, state.error);

  if (state.step === "done") {
    return (
      <Card className="space-y-5 p-6">
        <SectionHeading title={t.doneTitle} level={1} />
        <Alert tone="positive">{interpolate(t.doneBody, { email: state.email })}</Alert>
        <Link href={`/${locale}/login`} className="underline underline-offset-2">
          {dictionary.common.login}
        </Link>
      </Card>
    );
  }

  if (state.step === "confirm") {
    return (
      <Card className="space-y-5 p-6">
        <SectionHeading
          title={t.codeTitle}
          description={interpolate(t.codeIntro, { minutes, email: state.email })}
          level={1}
        />
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="inviteId" value={state.inviteId} />
          <input type="hidden" name="email" value={state.email} />
          {message ? <Alert tone="danger">{message}</Alert> : null}
          <Field label={t.codeLabel} htmlFor="code" required>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? dictionary.common.loading : t.confirm}
            </Button>
            <Button type="submit" name="intent" value="restart" variant="secondary" disabled={pending}>
              {t.startOver}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-6">
      <SectionHeading title={t.title} description={t.intro} level={1} />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {message ? <Alert tone="danger">{message}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={dictionary.funnel.profile.firstName} htmlFor="firstName" optionalLabel={dictionary.common.optional}>
            <Input id="firstName" name="firstName" autoComplete="given-name" />
          </Field>
          <Field label={dictionary.funnel.profile.lastName} htmlFor="lastName" optionalLabel={dictionary.common.optional}>
            <Input id="lastName" name="lastName" autoComplete="family-name" />
          </Field>
        </div>
        <Field label={dictionary.auth.email} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={dictionary.auth.password} htmlFor="password" hint={dictionary.auth.passwordHint} required>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
        </Field>
        <Field label={dictionary.auth.passwordRepeat} htmlFor="passwordRepeat" required>
          <Input id="passwordRepeat" name="passwordRepeat" type="password" autoComplete="new-password" required />
        </Field>
        <Field label={t.bootstrapKey} htmlFor="bootstrapKey" hint={t.bootstrapKeyHint} optionalLabel={dictionary.common.optional}>
          <Input id="bootstrapKey" name="bootstrapKey" type="password" autoComplete="off" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : t.request}
        </Button>
      </form>
    </Card>
  );
}
