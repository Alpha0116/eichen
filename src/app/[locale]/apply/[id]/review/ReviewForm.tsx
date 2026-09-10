"use client";

import { useActionState } from "react";
import { Alert, Button, Card, Checkbox, SectionHeading } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { ActionState } from "../../actions";

/**
 * The last screen before an administrator sees the file: a recap, the SCHUFA
 * option, and the consents.
 *
 * The SCHUFA choice sits on its own card, above the consents and visually
 * apart from them. It is the single place the word appears in this product,
 * and it is an option, not a permission being extracted — grouping it with the
 * required checkboxes would make it read as one more box to tick through.
 */
export function ReviewForm({
  dictionary,
  schufaOptIn,
  action,
}: {
  dictionary: Dictionary;
  schufaOptIn: boolean;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const t = dictionary.funnel.review;
  const c = dictionary.consent;

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.schufaTitle} description={t.schufaIntro} level={3} />
        <Checkbox id="schufaOptIn" name="schufaOptIn" defaultChecked={schufaOptIn}>
          {t.schufaOption}
        </Checkbox>
        <Alert variant="outline" tone="neutral">
          <p>{t.schufaNotice}</p>
        </Alert>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.consentTitle} description={t.consentIntro} level={3} />

        {state.error === "consentRequired" ? (
          <Alert tone="danger">{dictionary.errors.consentRequired}</Alert>
        ) : null}
        {state.error === "notEligible" ? (
          <Alert tone="danger" title={dictionary.errors.notEligibleTitle}>
            <p>{dictionary.errors.notEligible}</p>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <Checkbox id="consent_TERMS_AND_PRIVACY" name="consent_TERMS_AND_PRIVACY" required>
            {c.terms_and_privacy}
          </Checkbox>
          <Checkbox id="consent_MARKETING_EMAIL" name="consent_MARKETING_EMAIL">
            {c.marketing_email}
            <span className="ml-1.5 text-xs text-[var(--muted)]">({dictionary.common.optional})</span>
          </Checkbox>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : t.submit}
        </Button>
        <p className="text-xs text-[var(--muted)]">{t.submitHint}</p>
      </div>
    </form>
  );
}
