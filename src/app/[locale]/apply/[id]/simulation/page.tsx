import { redirect } from "next/navigation";
import { Simulator } from "@/components/Simulator";
import { Alert } from "@/components/ui";
import type { LoanPurpose } from "@/domain/application/types";
import { isEditable, type ApplicationState } from "@/domain/application/states";
import { getDictionary, type Locale } from "@/i18n";
import { requireApplicationAccess } from "@/server/access";
import { PRODUCT } from "@/server/config";
import { db } from "@/server/db";
import { saveSimulationAction } from "../../actions";

/**
 * Step 1a. The same simulator the landing page used to carry, now inside the
 * application: the borrower sets what they want and sees the instalment before
 * they type a single personal detail.
 */
export default async function SimulationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const application = await db.application.findUniqueOrThrow({
    where: { id },
    select: { amount: true, termMonths: true, purpose: true, state: true },
  });

  // Once the file is with an administrator, the figures they are looking at
  // must not move under them.
  if (!isEditable(application.state as ApplicationState)) {
    redirect(`/${locale}/apply/${id}/status`);
  }

  const dictionary = getDictionary(locale);
  const action = saveSimulationAction.bind(null, locale, id);

  return (
    <div className="space-y-5">
      <Alert variant="outline" tone="accent" title={dictionary.funnel.simulation.title}>
        <p>{dictionary.funnel.simulation.intro}</p>
      </Alert>
      <Simulator
        locale={locale as Locale}
        dictionary={dictionary}
        action={action}
        ctaLabel={dictionary.common.continue}
        footnote={dictionary.funnel.simulation.footnote}
        limits={{
          minAmount: PRODUCT.minAmount,
          maxAmount: PRODUCT.maxAmount,
          amountStep: PRODUCT.amountStep,
          defaultAmount: application.amount,
          termOptions: PRODUCT.termOptions,
          defaultTermMonths: application.termMonths,
          defaultPurpose: application.purpose as LoanPurpose,
          referenceRate: PRODUCT.referenceRate,
        }}
      />
    </div>
  );
}
