import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { ChangePasswordForm } from "../(auth)/AuthForms";
import { changePasswordAction } from "../(auth)/actions";
import { getDictionary, type Locale } from "@/i18n";
import { privateMetadata } from "@/i18n/seo";
import { getSessionUser } from "@/server/auth/session";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

/**
 * Where an account lands when its password was set by somebody else.
 *
 * This is the one page the guards do not redirect away from, so it checks the
 * flag itself: an account that has nothing to change here would otherwise be
 * left staring at a form it cannot submit.
 */
export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/password`)}`);
  if (!user.mustChangePassword) redirect(`/${locale}/account`);

  const dictionary = getDictionary(locale);

  return (
    <AuthShell
      locale={locale as Locale}
      dictionary={dictionary}
      title={dictionary.auth.changeTitle}
    >
      <ChangePasswordForm dictionary={dictionary} locale={locale} action={changePasswordAction} />
    </AuthShell>
  );
}
