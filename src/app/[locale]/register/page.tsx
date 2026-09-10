import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "../(auth)/AuthForms";
import { registerAction } from "../(auth)/actions";
import { getDictionary, type Locale } from "@/i18n";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

export default async function RegisterPage({
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
      title={dictionary.auth.registerTitle}
    >
      <RegisterForm dictionary={dictionary} locale={locale} next={next} action={registerAction} />
    </AuthShell>
  );
}
