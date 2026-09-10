import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "../(auth)/AuthForms";
import { loginAction } from "../(auth)/actions";
import { getDictionary, type Locale } from "@/i18n";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const dictionary = getDictionary(locale);

  return (
    <AuthShell
      locale={locale as Locale}
      dictionary={dictionary}
      title={dictionary.auth.loginTitle}
    >
      <LoginForm dictionary={dictionary} locale={locale} next={next} action={loginAction} />
    </AuthShell>
  );
}
