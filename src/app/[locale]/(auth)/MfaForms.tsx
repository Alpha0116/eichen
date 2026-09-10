"use client";

import { useActionState } from "react";
import { Alert, Button, Card, Field, Input, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import { interpolate } from "@/i18n";
import type { MfaState } from "./mfa-actions";

function message(dictionary: Dictionary, state: MfaState): string | null {
  switch (state.error) {
    case "invalidCode":
      return dictionary.mfa.invalidCode;
    case "locked":
      return interpolate(dictionary.mfa.locked, { minutes: state.minutes ?? 15 });
    case "expired":
      return dictionary.mfa.expired;
    case "notEnrolled":
      return dictionary.mfa.setupRequired;
    case "validation":
      return dictionary.errors.validation;
    default:
      return null;
  }
}

/** One-time-code field: numeric keypad, autofocus, no autocorrect. */
function CodeInput({ id = "code" }: { id?: string }) {
  return (
    <Input
      id={id}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={20}
      required
      className="max-w-[14rem] tabular tracking-[0.25em]"
    />
  );
}

export function MfaChallengeForm({
  dictionary,
  locale,
  next,
  action,
}: {
  dictionary: Dictionary;
  locale: string;
  next?: string;
  action: (previous: MfaState, formData: FormData) => Promise<MfaState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const error = message(dictionary, state);

  return (
    <Card className="space-y-5 p-6">
      <SectionHeading
        title={dictionary.mfa.challengeTitle}
        description={dictionary.mfa.challengeBody}
        level={1}
      />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Field
          label={dictionary.mfa.codeLabel}
          htmlFor="code"
          hint={dictionary.mfa.codeHint}
          required
        >
          <CodeInput />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : dictionary.mfa.verify}
        </Button>
      </form>
    </Card>
  );
}

export function MfaSetupPanel({
  dictionary,
  locale,
  next,
  mandatory,
  qrSvg,
  secretForDisplay,
  otpauthUri,
  confirmAction,
  finishAction,
}: {
  dictionary: Dictionary;
  locale: string;
  next?: string;
  mandatory: boolean;
  qrSvg: string;
  secretForDisplay: string;
  otpauthUri: string;
  confirmAction: (previous: MfaState, formData: FormData) => Promise<MfaState>;
  finishAction: () => void;
}) {
  const [state, formAction, pending] = useActionState(confirmAction, {});
  const error = message(dictionary, state);
  const t = dictionary.mfa;

  // Once the codes exist the setup is done; showing the QR again would invite
  // a second enrolment that would invalidate the codes just handed over.
  if (state.recoveryCodes) {
    return (
      <Card className="space-y-5 p-6">
        <SectionHeading title={t.recoveryTitle} description={t.recoveryBody} level={1} />
        <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 font-mono text-sm">
          {state.recoveryCodes.map((code) => (
            <li key={code} className="tabular tracking-wider">
              {code}
            </li>
          ))}
        </ul>
        <form action={finishAction}>
          <Button type="submit">{t.recoveryAcknowledge}</Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-6 p-6">
      <SectionHeading
        title={t.setupTitle}
        description={mandatory ? t.setupRequired : t.setupOptional}
        level={1}
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t.scanTitle}</h2>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{t.scanBody}</p>
        <div
          className="w-fit rounded-[var(--radius)] border border-[var(--border)] bg-white p-3"
          // The QR is generated server-side as SVG from the otpauth URI; no
          // markup from the user reaches this.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t.manualTitle}</summary>
          <p className="mt-2 text-[var(--muted)]">{t.manualBody}</p>
          <p className="mt-1 font-mono text-sm tracking-wider break-all">{secretForDisplay}</p>
          <p className="mt-2 break-all text-xs text-[var(--muted)]">{otpauthUri}</p>
        </details>
      </section>

      <section className="space-y-3 border-t border-[var(--border)] pt-5">
        <h2 className="text-base font-semibold">{t.confirmTitle}</h2>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{t.confirmBody}</p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label={t.codeLabel} htmlFor="setup-code" required>
            <CodeInput id="setup-code" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? dictionary.common.loading : t.confirm}
          </Button>
        </form>
      </section>
    </Card>
  );
}
