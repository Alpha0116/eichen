"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Field, Input, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import { interpolate } from "@/i18n";
import type { AuthFormState } from "./actions";

function errorMessage(dictionary: Dictionary, state: AuthFormState): string | null {
  switch (state.error) {
    case "invalidCredentials":
      return dictionary.auth.invalidCredentials;
    case "accountLocked":
      return interpolate(dictionary.auth.accountLocked, { minutes: state.minutes ?? 15 });
    case "passwordMismatch":
      return dictionary.auth.passwordMismatch;
    case "emailTaken":
      return dictionary.auth.emailTaken;
    case "passwordTooShort":
    case "passwordTooCommon":
      return dictionary.auth.passwordHint;
    case "sameAsOld":
      return dictionary.auth.sameAsOld;
    case "validation":
      return dictionary.errors.validation;
    default:
      return null;
  }
}

export function LoginForm({
  dictionary,
  locale,
  next,
  action,
}: {
  dictionary: Dictionary;
  locale: string;
  next?: string;
  action: (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const message = errorMessage(dictionary, state);

  return (
    <Card className="space-y-5 p-6">
      <SectionHeading title={dictionary.auth.loginTitle} level={1} />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {message ? <Alert tone="danger">{message}</Alert> : null}

        <Field label={dictionary.auth.email} htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={dictionary.auth.password} htmlFor="password" required>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : dictionary.common.login}
        </Button>
      </form>
      <p className="text-sm text-[var(--muted)]">
        {dictionary.auth.noAccount}{" "}
        <Link href={`/${locale}/register`} className="underline underline-offset-2">
          {dictionary.common.register}
        </Link>
      </p>
    </Card>
  );
}

export function RegisterForm({
  dictionary,
  locale,
  next,
  action,
}: {
  dictionary: Dictionary;
  locale: string;
  next?: string;
  action: (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const message = errorMessage(dictionary, state);

  return (
    <Card className="space-y-5 p-6">
      <SectionHeading
        title={dictionary.auth.registerTitle}
        description={dictionary.auth.registerIntro}
        level={1}
      />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            aria-describedby="password-hint"
          />
        </Field>
        <Field label={dictionary.auth.passwordRepeat} htmlFor="passwordRepeat" required>
          <Input id="passwordRepeat" name="passwordRepeat" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : dictionary.common.register}
        </Button>
      </form>
      <p className="text-sm text-[var(--muted)]">
        {dictionary.auth.hasAccount}{" "}
        <Link href={`/${locale}/login`} className="underline underline-offset-2">
          {dictionary.common.login}
        </Link>
      </p>
    </Card>
  );
}

/**
 * The first-login password change.
 *
 * Deliberately offers no way past it: no link back to the account, no skip.
 * The guards send the account here on every page it tries to open, so a way
 * out of this card would only be a way to go round in a circle.
 */
export function ChangePasswordForm({
  dictionary,
  locale,
  action,
}: {
  dictionary: Dictionary;
  locale: string;
  action: (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const message = errorMessage(dictionary, state);

  return (
    <Card className="space-y-5 p-6">
      <SectionHeading
        title={dictionary.auth.changeTitle}
        description={dictionary.auth.changeIntro}
        level={1}
      />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {message ? <Alert tone="danger">{message}</Alert> : null}

        <Field label={dictionary.auth.currentPassword} htmlFor="currentPassword" required>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field
          label={dictionary.auth.newPassword}
          htmlFor="password"
          hint={dictionary.auth.passwordHint}
          required
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label={dictionary.auth.newPasswordRepeat} htmlFor="passwordRepeat" required>
          <Input
            id="passwordRepeat"
            name="passwordRepeat"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : dictionary.auth.changeSubmit}
        </Button>
      </form>
    </Card>
  );
}
