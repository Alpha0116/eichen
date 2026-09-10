import { redirect } from "next/navigation";
import { MfaSetupPanel } from "../../(auth)/MfaForms";
import { confirmEnrolmentAction, finishEnrolmentAction } from "../../(auth)/mfa-actions";
import { getDictionary } from "@/i18n";
import { getPendingMfaUser } from "@/server/auth/session";
import { beginEnrolment, mfaRequiredFor } from "@/server/auth/mfa";
import { otpauthQrSvg } from "@/server/auth/qr";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

/**
 * Enrolment during a login that cannot complete without a second factor.
 *
 * A fresh candidate secret is minted on each visit. That is deliberate: the
 * previous candidate was never activated, so nothing is lost, and it means a
 * reloaded page can never show a QR that no longer matches what the server
 * would accept.
 */
export default async function MfaSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;

  const pending = await getPendingMfaUser();
  if (!pending) redirect(`/${locale}/login`);

  const dictionary = getDictionary(locale);
  const enrolment = await beginEnrolment(pending.id);
  const qrSvg = await otpauthQrSvg(enrolment.otpauthUri);
  const finish = finishEnrolmentAction.bind(null, locale, next);

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <MfaSetupPanel
        dictionary={dictionary}
        locale={locale}
        next={next}
        mandatory={mfaRequiredFor(pending.role)}
        qrSvg={qrSvg}
        secretForDisplay={enrolment.secretForDisplay}
        otpauthUri={enrolment.otpauthUri}
        confirmAction={confirmEnrolmentAction}
        finishAction={finish}
      />
      <p className="mt-4 text-xs text-[var(--muted)]">{pending.email}</p>
    </div>
  );
}
