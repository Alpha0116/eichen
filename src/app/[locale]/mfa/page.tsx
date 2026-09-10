import { redirect } from "next/navigation";
import { MfaChallengeForm } from "../(auth)/MfaForms";
import { verifyMfaAction } from "../(auth)/mfa-actions";
import { getDictionary } from "@/i18n";
import { getPendingMfaUser } from "@/server/auth/session";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

export default async function MfaChallengePage({
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
  // A staff member who has not enrolled yet belongs on the setup page.
  if (!pending.mfaEnabled) redirect(`/${locale}/mfa/setup`);

  const dictionary = getDictionary(locale);

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <MfaChallengeForm
        dictionary={dictionary}
        locale={locale}
        next={next}
        action={verifyMfaAction}
      />
      <p className="mt-4 text-xs text-[var(--muted)]">{pending.email}</p>
    </div>
  );
}
