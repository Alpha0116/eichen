import Link from "next/link";
import { Alert, Badge, Button, Card, SectionHeading } from "@/components/ui";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { mfaRequiredFor, remainingRecoveryCodes } from "@/server/auth/mfa";
import { disableMfaAction } from "../../(auth)/mfa-actions";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await requireUser(locale, `/${locale}/account/security`);

  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.mfa;

  const mandatory = mfaRequiredFor(session.role);
  const remaining = user.mfaEnabled ? await remainingRecoveryCodes(user.id) : 0;
  const disable = disableMfaAction.bind(null, locale);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <SectionHeading title={t.securityTitle} level={1} />

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t.title}</h2>
          <Badge tone={user.mfaEnabled ? "positive" : mandatory ? "danger" : "neutral"}>
            {user.mfaEnabled && user.mfaEnrolledAt
              ? interpolate(t.statusEnabled, { date: formatDate(user.mfaEnrolledAt, typedLocale) })
              : t.statusDisabled}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {mandatory ? t.setupRequired : t.setupOptional}
        </p>

        {user.mfaEnabled ? (
          <>
            <p className="text-sm">{interpolate(t.remainingCodes, { count: remaining })}</p>
            {/* Running low on recovery codes is worth saying before it becomes
                a support call. */}
            {remaining <= 2 ? (
              <Alert tone="warning">{interpolate(t.remainingCodes, { count: remaining })}</Alert>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/account/security/setup`}
                className="text-sm underline underline-offset-2"
              >
                {t.regenerate}
              </Link>
              {mandatory ? (
                <p className="text-sm text-[var(--muted)]">{t.disableNotAllowed}</p>
              ) : (
                <form action={disable}>
                  <Button type="submit" variant="danger" size="sm">
                    {t.disable}
                  </Button>
                </form>
              )}
            </div>
          </>
        ) : (
          <Link
            href={`/${locale}/account/security/setup`}
            className="inline-flex items-center rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)]"
          >
            {t.enable}
          </Link>
        )}
      </Card>
    </div>
  );
}
