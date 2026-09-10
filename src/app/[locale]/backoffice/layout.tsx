import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getDictionary } from "@/i18n";
import { requireStaff } from "@/server/access";
import { privateMetadata } from "@/i18n/seo";

/** Behind a login: nothing here belongs in a search index. */
export const metadata = privateMetadata;

const TABS = [
  { slug: "", key: "queue" },
  { slug: "/rules", key: "rulesTitle" },
  { slug: "/lenders", key: "lendersTitle" },
  { slug: "/kpi", key: "kpiTitle" },
] as const;

export default async function BackofficeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const agent = await requireStaff(locale, `/${locale}/backoffice`);
  const dictionary = getDictionary(locale);

  return (
    // A tinted page ground rather than white: this is a working tool, and the
    // cards and tables in it need something to sit on to read as objects.
    <div className="min-h-full bg-[var(--surface-muted)]">
      <PageHeader
        title={dictionary.backoffice.title}
        description={dictionary.backoffice.intro}
        eyebrow={`${agent.email} · ${agent.role}`}
      >
        <nav className="flex flex-wrap gap-2 text-sm">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/${locale}/backoffice${tab.slug}`}
              className="rounded-[var(--radius-full)] border border-white/30 bg-white/10 px-4 py-1.5 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {dictionary.backoffice[tab.key]}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="ds-container py-10 sm:py-12">{children}</div>
    </div>
  );
}
