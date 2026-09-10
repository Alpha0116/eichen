import type { Offer } from "../../domain/offers/types";
import { db } from "../db";
import { fromJsonWithDates } from "../json";

export async function offersFor(applicationId: string) {
  const rows = await db.offer.findMany({
    where: { applicationId },
    orderBy: { effectiveAnnualRate: "asc" },
  });
  return rows.map((row) => ({
    row,
    offer: fromJsonWithDates<Offer | null>(row.payloadJson, null),
  }));
}

export async function selectedOffer(applicationId: string) {
  const row = await db.offer.findFirst({
    where: { applicationId, selectedAt: { not: null } },
  });
  if (!row) return null;
  return { row, offer: fromJsonWithDates<Offer | null>(row.payloadJson, null) };
}

/**
 * The single offer attached to an application.
 *
 * There is one product at one rate, so the offer is created and selected in
 * the same breath at submission (see `submitApplication`). Nothing here
 * selects anything: a comparison the borrower cannot make is not a choice to
 * put in front of them.
 */
export async function offerFor(applicationId: string) {
  return selectedOffer(applicationId);
}
