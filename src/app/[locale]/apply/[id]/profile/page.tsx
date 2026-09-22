import { redirect } from "next/navigation";
import { isEditable, type ApplicationState } from "@/domain/application/states";
import { getDictionary } from "@/i18n";
import { requireApplicationAccess } from "@/server/access";
import { db } from "@/server/db";
import { saveProfileAction } from "../../actions";
import { ProfileForm } from "./ProfileForm";

/** Cents to the decimal string the form edits, blank rather than "0.00" when
    nothing has been entered yet — a pre-filled zero reads as an answer. */
function euros(value: number | undefined, filled: boolean): string {
  if (!filled) return "";
  return ((value ?? 0) / 100).toFixed(2);
}

/** The same for a count of months: nothing entered yet shows the example, not
    a zero that claims they moved in today. */
function months(value: number | undefined, filled: boolean): string {
  if (!filled) return "";
  return String(value ?? 0);
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const access = await requireApplicationAccess(id);

  const [application, primary, co, user] = await Promise.all([
    db.application.findUniqueOrThrow({
      where: { id },
      select: { state: true, bankName: true, maskedIban: true, household: true },
    }),
    db.applicant.findUnique({ where: { applicationId_role: { applicationId: id, role: "PRIMARY" } } }),
    db.applicant.findUnique({ where: { applicationId_role: { applicationId: id, role: "CO_BORROWER" } } }),
    access.user ? db.user.findUnique({ where: { id: access.user.id } }) : null,
  ]);

  if (!isEditable(application.state as ApplicationState)) {
    redirect(`/${locale}/apply/${id}/status`);
  }

  const dictionary = getDictionary(locale);
  const action = saveProfileAction.bind(null, locale, id);
  const household = application.household;
  const seen = primary !== null;

  return (
    <ProfileForm
      dictionary={dictionary}
      action={action}
      defaults={{
        // A signed-in borrower should not retype what they registered with.
        firstName: primary?.firstName ?? user?.firstName ?? "",
        lastName: primary?.lastName ?? user?.lastName ?? "",
        birthDate: primary?.birthDate ?? "",
        email: primary?.email ?? user?.email ?? "",
        phone: primary?.phone ?? "",
        street: primary?.street ?? "",
        postalCode: primary?.postalCode ?? "",
        city: primary?.city ?? "",
        residentSinceMonths: months(primary?.residentSinceMonths, seen),
        employmentType: primary?.employmentType ?? "PERMANENT",
        employerName: primary?.employerName ?? "",
        employedSinceMonths: months(primary?.employedSinceMonths, seen),
        employmentEndsOn: primary?.employmentEndsOn ?? "",
        netMonthlyIncome: euros(primary?.netMonthlyIncome, seen),
        otherMonthlyIncome: euros(primary?.otherMonthlyIncome, seen),
        adults: household?.adults ?? 1,
        children: household?.children ?? 0,
        housingStatus: household?.housingStatus ?? "RENT",
        monthlyHousingCost: euros(household?.monthlyHousingCost, seen),
        existingLoanInstalments: euros(household?.existingLoanInstalments, seen),
        otherFixedCosts: euros(household?.otherFixedCosts, seen),
        bankName: application.bankName ?? "",
        maskedIban: application.maskedIban,
        coBorrower: co
          ? {
              firstName: co.firstName,
              lastName: co.lastName,
              birthDate: co.birthDate,
              email: co.email,
              netMonthlyIncome: (co.netMonthlyIncome / 100).toFixed(2),
              employmentType: co.employmentType,
            }
          : null,
      }}
    />
  );
}
