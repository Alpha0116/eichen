import { Alert, Badge, ButtonLink, Card, SectionHeading } from "@/components/ui";
import { getDictionary, interpolate } from "@/i18n";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n";
import { requireApplicationAccess } from "@/server/access";
import { documentsComplete, documentsFor, requiredDocuments } from "@/server/services/documents";
import { uploadDocumentAction } from "../../actions";
import { UploadForm } from "./UploadForm";

const STATUS_TONE = {
  RECEIVED: "neutral",
  READABLE: "info",
  VALIDATED: "positive",
  REJECTED: "danger",
} as const;

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const [required, documents, complete] = await Promise.all([
    requiredDocuments(id),
    documentsFor(id),
    documentsComplete(id),
  ]);

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const upload = uploadDocumentAction.bind(null, locale, id);
  const t = dictionary.documents;

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.title} description={t.intro} level={2} />
        <p className="text-xs text-[var(--muted)]">{t.noVirusNotice}</p>

        {complete ? <Alert tone="positive">{t.allDone}</Alert> : null}

        <ul className="space-y-5">
          {required.map((kind) => {
            const forKind = documents.filter(
              (document) => document.kind === kind && document.replacedById === null,
            );
            const latest = forKind.at(-1);

            return (
              <li key={kind} className="rounded-[var(--radius)] border border-[var(--border)] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t.kinds[kind]}</h3>
                  {latest ? (
                    <Badge tone={STATUS_TONE[latest.status as keyof typeof STATUS_TONE]}>
                      {t.status[latest.status as keyof typeof t.status]}
                    </Badge>
                  ) : null}
                </div>

                {latest ? (
                  <p className="mb-3 text-xs text-[var(--muted)] tabular">
                    {latest.filename} · {formatDateTime(latest.uploadedAt, typedLocale)}
                  </p>
                ) : null}

                {latest?.status === "REJECTED" && latest.rejectionCode ? (
                  <Alert tone="danger">
                    {interpolate(t.rejectedNotice, {
                      reason: t.rejection[latest.rejectionCode as keyof typeof t.rejection] ?? "",
                    })}
                  </Alert>
                ) : null}

                {latest?.status !== "VALIDATED" ? (
                  <div className="mt-3">
                    <UploadForm
                      kind={kind}
                      label={latest ? t.replace : t.dropzone}
                      dictionary={dictionary}
                      action={upload}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* The next step in the funnel, not a leftover route: identity
          verification was removed with the old flow, and a link to it was
          prefetching a 404 on every visit to this page. */}
      <ButtonLink href={`/${locale}/apply/${id}/review`}>
        {dictionary.funnel.review.title} →
      </ButtonLink>
    </div>
  );
}
