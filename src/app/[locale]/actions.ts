"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { requireUser } from "@/server/access";
import { PRODUCT } from "@/server/config";
import { createApplication } from "@/server/services/application";
import { clampAmount, clampTerm, recordSimulation } from "@/server/services/simulation";

const startSchema = z.object({
  amount: z.coerce.number().int().positive().optional(),
  termMonths: z.coerce.number().int().positive().optional(),
  purpose: z
    .enum([
      "FREE_USE",
      "VEHICLE",
      "RENOVATION",
      "DEBT_CONSOLIDATION",
      "FURNITURE",
      "EDUCATION",
      "MEDICAL",
      "TRAVEL",
    ])
    .optional(),
});

/**
 * Opens a new application for the signed-in borrower.
 *
 * An account comes first in this flow, so there is no anonymous draft to
 * reconcile: `requireUser` redirects to the login page with a `next` that
 * brings them back here once they are in. The simulation row is still written
 * and linked, which is what keeps the account-to-application conversion
 * measurable.
 */
export async function startApplicationAction(locale: string, formData: FormData): Promise<void> {
  const safeLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const user = await requireUser(safeLocale, `/${safeLocale}/account`);

  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  const raw = parsed.success ? parsed.data : {};

  // Opened from the account page, the form carries nothing — so the product's
  // defaults apply, not zero. Clamping zero would start every new application
  // at the *minimum* amount over the *shortest* term, which is a worse first
  // screen than the mid-range figures the home page advertises.
  const amount = clampAmount(raw.amount ?? PRODUCT.defaultAmount);
  const termMonths = clampTerm(raw.termMonths ?? PRODUCT.defaultTermMonths);
  const purpose = raw.purpose ?? "FREE_USE";

  const { simulation } = await recordSimulation({
    amount,
    termMonths,
    purpose,
    locale: safeLocale,
  });

  const { application } = await createApplication({
    amount,
    termMonths,
    purpose,
    locale: safeLocale,
    userId: user.id,
    simulationId: simulation.id,
  });

  redirect(`/${safeLocale}/apply/${application.id}/simulation`);
}
