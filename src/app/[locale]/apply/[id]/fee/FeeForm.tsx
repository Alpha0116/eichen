"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Checkbox, Field, Input, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { ActionState } from "../../actions";

/**
 * Paying the account fee by card.
 *
 * The card is the only way this fee is settled, so there is nothing to choose:
 * the form asks for the card and gets out of the way. Every field is formatted
 * as it is typed — digits in groups of four, an expiry that inserts its own
 * slash — because a card number typed into a plain box is the easiest thing on
 * a payment page to get wrong.
 *
 * None of this is validation. The action re-checks the number, the expiry and
 * the code on the server, where the borrower's browser cannot be talked out of
 * it, and nothing typed here is kept once the charge has been made.
 */
export function FeeForm({
  dictionary,
  action,
}: {
  dictionary: Dictionary;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const t = dictionary.fee;

  const fieldError = (field: string) =>
    state.field === field && state.error && state.error in t.cardErrors
      ? t.cardErrors[state.error as keyof typeof t.cardErrors]
      : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.cardTitle} description={t.cardIntro} level={3} />

        {state.error === "chargeDeclined" ? (
          <Alert tone="danger" title={t.declinedTitle}>
            <p>{t.declinedBody}</p>
          </Alert>
        ) : null}
        {state.error === "consentRequired" ? (
          <Alert tone="danger">{dictionary.errors.consentRequired}</Alert>
        ) : null}
        {state.error === "feeEXPIRED" ? <Alert tone="warning">{t.expired}</Alert> : null}

        <Field
          label={t.cardNumber}
          htmlFor="cardNumber"
          required
          error={fieldError("cardNumber")}
        >
          <Input
            id="cardNumber"
            name="cardNumber"
            value={number}
            onChange={(event) => setNumber(groupDigits(event.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            maxLength={23}
            required
            className="tabular"
          />
        </Field>

        <Field label={t.cardHolder} htmlFor="cardHolder" required error={fieldError("cardHolder")}>
          <Input
            id="cardHolder"
            name="cardHolder"
            autoComplete="cc-name"
            autoCapitalize="characters"
            maxLength={60}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.cardExpiry}
            htmlFor="cardExpiry"
            hint={t.cardExpiryHint}
            required
            error={fieldError("cardExpiry")}
          >
            <Input
              id="cardExpiry"
              name="cardExpiry"
              value={expiry}
              onChange={(event) => setExpiry(formatExpiry(event.target.value))}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              maxLength={5}
              required
              className="tabular"
            />
          </Field>

          <Field
            label={t.cardCvc}
            htmlFor="cardCvc"
            hint={t.cardCvcHint}
            required
            error={fieldError("cardCvc")}
          >
            <Input
              id="cardCvc"
              name="cardCvc"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              maxLength={4}
              pattern="[0-9]{3,4}"
              required
              className="tabular"
            />
          </Field>
        </div>

        <p className="text-xs leading-relaxed text-[var(--muted)]">{t.cardSecurity}</p>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <Checkbox id="consent_ACCOUNT_FEE_TERMS" name="consent_ACCOUNT_FEE_TERMS" required>
          {dictionary.consent.account_fee_terms}
        </Checkbox>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? dictionary.common.loading : t.submit}
          </Button>
          <p className="text-xs text-[var(--muted)]">{t.submitHint}</p>
        </div>
      </Card>
    </form>
  );
}

/** Digits in groups of four, which is how a card is printed and read aloud. */
function groupDigits(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * MM/YY, with the slash inserted rather than demanded.
 *
 * A lone leading digit above one is a month on its own — a "4" can only mean
 * April — so it is padded, which saves the borrower a keystroke and prevents
 * "42" ever being typed into a month.
 */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 1) return Number(digits) > 1 ? `0${digits}/` : digits;
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
