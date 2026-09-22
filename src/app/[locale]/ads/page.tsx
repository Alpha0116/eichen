import { AuthShell } from "@/components/AuthShell";
import { getDictionary, type Locale } from "@/i18n";
import { privateMetadata } from "@/i18n/seo";
import { CODE_TTL_MINUTES } from "@/server/services/adminSetup";
import { AdminSetupForm } from "./AdminSetupForm";
import { confirmAdminAction, requestAdminAction } from "./actions";

/** Reachable without a login, but nothing here belongs in a search index. */
export const metadata = privateMetadata;

export default async function AdminSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dictionary = getDictionary(locale);

  return (
    <AuthShell locale={locale as Locale} dictionary={dictionary} title={dictionary.adminSetup.title}>
      <AdminSetupForm
        dictionary={dictionary}
        locale={locale}
        minutes={CODE_TTL_MINUTES}
        requestAction={requestAdminAction}
        confirmAction={confirmAdminAction}
      />
    </AuthShell>
  );
}
