import { Badge, Button, Card, SectionHeading } from "@/components/ui";
import type { LenderProduct } from "@/domain/offers/types";
import { getDictionary, type Locale } from "@/i18n";
import { formatMoney, formatPercent } from "@/i18n/format";
import { requireStaff } from "@/server/access";
import { db } from "@/server/db";
import { fromJson } from "@/server/json";
import { toggleLenderAction } from "../actions";

export default async function LendersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireStaff(locale);

  const records = await db.lenderProductRecord.findMany({ orderBy: { lenderName: "asc" } });
  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.backoffice;

  return (
    <div className="space-y-6">
      <SectionHeading title={t.lendersTitle} level={2} />
      <ul className="space-y-3">
        {records.map((record) => {
          const product = fromJson<LenderProduct | null>(record.payloadJson, null);
          const toggle = toggleLenderAction.bind(null, locale, record.id);
          return (
            <Card as="li" key={record.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{record.lenderName}</p>
                {product ? (
                  <p className="tabular text-xs text-[var(--muted)]">
                    {formatMoney(product.minAmount, typedLocale, "EUR", { showDecimals: false })}–
                    {formatMoney(product.maxAmount, typedLocale, "EUR", { showDecimals: false })} ·{" "}
                    {product.minTermMonths}–{product.maxTermMonths} {dictionary.common.months} ·{" "}
                    {dictionary.offers.nominalRate} {dictionary.common.from}{" "}
                    {formatPercent(product.baseRate, typedLocale)} · {product.commissionBps} bps
                    {product.sponsored ? ` · ${dictionary.offers.sponsoredBadge}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={record.active ? "positive" : "neutral"}>
                  {record.active ? t.lenderActive : t.lenderInactive}
                </Badge>
                <form action={toggle}>
                  <Button type="submit" size="sm" variant="secondary">
                    {record.active ? t.lenderInactive : t.lenderActive}
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
