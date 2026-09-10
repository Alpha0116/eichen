import { MfaSetupPanel } from "../../../(auth)/MfaForms";
import { confirmEnrolmentAction, finishEnrolmentAction } from "../../../(auth)/mfa-actions";
import { getDictionary } from "@/i18n";
import { requireUser } from "@/server/access";
import { beginEnrolment, mfaRequiredFor } from "@/server/auth/mfa";
import { otpauthQrSvg } from "@/server/auth/qr";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

/** Voluntary enrolment, or re-enrolment to mint fresh recovery codes. */
export default async function SecuritySetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale, `/${locale}/account/security/setup`);

  const dictionary = getDictionary(locale);
  const enrolment = await beginEnrolment(user.id);
  const qrSvg = await otpauthQrSvg(enrolment.otpauthUri);
  const finish = finishEnrolmentAction.bind(null, locale, `/${locale}/account/security`);

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <MfaSetupPanel
        dictionary={dictionary}
        locale={locale}
        mandatory={mfaRequiredFor(user.role)}
        qrSvg={qrSvg}
        secretForDisplay={enrolment.secretForDisplay}
        otpauthUri={enrolment.otpauthUri}
        confirmAction={confirmEnrolmentAction}
        finishAction={finish}
      />
    </div>
  );
}
