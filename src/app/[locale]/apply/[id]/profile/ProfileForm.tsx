"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Field, Input, SectionHeading, Select } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { ActionState } from "../../actions";

const EMPLOYMENT_TYPES = [
  "PERMANENT",
  "FIXED_TERM",
  "PROBATION",
  "CIVIL_SERVANT",
  "SELF_EMPLOYED",
  "PENSIONER",
  "STUDENT",
  "PARENTAL_LEAVE",
  "UNEMPLOYED",
] as const;

const HOUSING = ["RENT", "OWN", "WITH_PARENTS"] as const;

/** Employment kinds that end on a date, for which the end date is asked. */
const FIXED_TERM_TYPES = new Set(["FIXED_TERM", "PROBATION"]);

export interface ProfileDefaults {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  residentSinceMonths: string;
  employmentType: string;
  employerName: string;
  employedSinceMonths: string;
  employmentEndsOn: string;
  netMonthlyIncome: string;
  otherMonthlyIncome: string;
  adults: number;
  children: number;
  housingStatus: string;
  monthlyHousingCost: string;
  existingLoanInstalments: string;
  otherFixedCosts: string;
  bankName: string;
  maskedIban: string | null;
  coBorrower: {
    firstName: string;
    lastName: string;
    birthDate: string;
    email: string;
    netMonthlyIncome: string;
    employmentType: string;
  } | null;
}

/**
 * Everything the file needs about the borrower, on one page: who they are,
 * where they live, how they earn, what the household costs, and where the
 * money would go.
 *
 * It is deliberately one page rather than four. Splitting it was worth it when
 * each step gated a provider call; with a single administrator reading the
 * whole file at once, four screens only adds four chances to abandon.
 *
 * Every field carries an example. A label says what is wanted, a placeholder
 * says what it should look like — which is the whole question on an amount
 * where the comma is the decimal mark, or a mobile number with a country
 * code. Dates and lists have none: the browser already shows their shape.
 */
export function ProfileForm({
  dictionary,
  defaults,
  action,
}: {
  dictionary: Dictionary;
  defaults: ProfileDefaults;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [employmentType, setEmploymentType] = useState(defaults.employmentType);
  const [withCoBorrower, setWithCoBorrower] = useState(defaults.coBorrower !== null);
  const t = dictionary.funnel.profile;
  const f = dictionary.funnel.finances;
  const b = dictionary.funnel.bank;

  const errorFor = (field: string) => {
    if (state.field !== field) return undefined;
    if (state.error === "ibanInvalid") return dictionary.errors.ibanInvalid;
    return dictionary.errors.validation;
  };

  return (
    <form action={formAction} className="space-y-6">
      {state.error && !state.field ? (
        <Alert tone="danger">{dictionary.errors.validation}</Alert>
      ) : null}

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.title} description={t.intro} level={2} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.firstName} htmlFor="firstName" required error={errorFor("firstName")}>
            <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required autoComplete="given-name" placeholder={t.firstNamePlaceholder} />
          </Field>
          <Field label={t.lastName} htmlFor="lastName" required error={errorFor("lastName")}>
            <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required autoComplete="family-name" placeholder={t.lastNamePlaceholder} />
          </Field>
          <Field label={t.birthDate} htmlFor="birthDate" required error={errorFor("birthDate")}>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} required autoComplete="bday" />
          </Field>
          <Field label={t.email} htmlFor="email" required error={errorFor("email")}>
            <Input id="email" name="email" type="email" defaultValue={defaults.email} required autoComplete="email" placeholder={t.emailPlaceholder} />
          </Field>
          <Field label={t.phone} htmlFor="phone" hint={t.phoneHint} required error={errorFor("phone")}>
            <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} required autoComplete="tel" placeholder={t.phonePlaceholder} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.addressTitle} description={t.addressIntro} level={3} />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
          <Field label={t.street} htmlFor="street" required error={errorFor("street")}>
            <Input id="street" name="street" defaultValue={defaults.street} required autoComplete="street-address" placeholder={t.streetPlaceholder} />
          </Field>
          <Field label={t.postalCode} htmlFor="postalCode" required error={errorFor("postalCode")}>
            <Input id="postalCode" name="postalCode" defaultValue={defaults.postalCode} required autoComplete="postal-code" inputMode="numeric" placeholder={t.postalCodePlaceholder} />
          </Field>
          <Field label={t.city} htmlFor="city" required error={errorFor("city")}>
            <Input id="city" name="city" defaultValue={defaults.city} required autoComplete="address-level2" placeholder={t.cityPlaceholder} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.residentSince} htmlFor="residentSinceMonths" hint={t.residentSinceHint} required error={errorFor("residentSinceMonths")}>
            <Input id="residentSinceMonths" name="residentSinceMonths" type="number" min={0} max={1200} defaultValue={defaults.residentSinceMonths} required placeholder={t.residentSincePlaceholder} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={f.title} description={f.intro} level={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={f.employmentType} htmlFor="employmentType" required error={errorFor("employmentType")}>
            <Select
              id="employmentType"
              name="employmentType"
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {dictionary.employment[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.employer} htmlFor="employerName" optionalLabel={dictionary.common.optional}>
            <Input id="employerName" name="employerName" defaultValue={defaults.employerName} autoComplete="organization" placeholder={f.employerPlaceholder} />
          </Field>
          <Field label={f.employedSince} htmlFor="employedSinceMonths" required error={errorFor("employedSinceMonths")}>
            <Input id="employedSinceMonths" name="employedSinceMonths" type="number" min={0} max={1200} defaultValue={defaults.employedSinceMonths} required placeholder={f.employedSincePlaceholder} />
          </Field>
          {/* Only asked where it exists: a permanent contract has no end date,
              and a blank field labelled "contract ends on" invites a guess. */}
          {FIXED_TERM_TYPES.has(employmentType) ? (
            <Field label={f.employmentEndsOn} htmlFor="employmentEndsOn" hint={f.employmentEndsOnHint}>
              <Input id="employmentEndsOn" name="employmentEndsOn" type="date" defaultValue={defaults.employmentEndsOn} />
            </Field>
          ) : null}
          <Field label={f.netIncome} htmlFor="netMonthlyIncome" hint={f.netIncomeHint} required error={errorFor("netMonthlyIncome")}>
            <Input id="netMonthlyIncome" name="netMonthlyIncome" inputMode="decimal" defaultValue={defaults.netMonthlyIncome} required placeholder={f.netIncomePlaceholder} />
          </Field>
          <Field label={f.otherIncome} htmlFor="otherMonthlyIncome" optionalLabel={dictionary.common.optional}>
            <Input id="otherMonthlyIncome" name="otherMonthlyIncome" inputMode="decimal" defaultValue={defaults.otherMonthlyIncome} placeholder={f.otherIncomePlaceholder} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={f.householdTitle} description={f.householdIntro} level={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={f.adults} htmlFor="adults" required error={errorFor("adults")}>
            <Input id="adults" name="adults" type="number" min={1} max={10} defaultValue={defaults.adults} required placeholder={f.adultsPlaceholder} />
          </Field>
          <Field label={f.children} htmlFor="children" required error={errorFor("children")}>
            <Input id="children" name="children" type="number" min={0} max={15} defaultValue={defaults.children} required placeholder={f.childrenPlaceholder} />
          </Field>
          <Field label={f.housingStatus} htmlFor="housingStatus" required>
            <Select id="housingStatus" name="housingStatus" defaultValue={defaults.housingStatus}>
              {HOUSING.map((status) => (
                <option key={status} value={status}>
                  {dictionary.housing[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.housingCost} htmlFor="monthlyHousingCost" required error={errorFor("monthlyHousingCost")}>
            <Input id="monthlyHousingCost" name="monthlyHousingCost" inputMode="decimal" defaultValue={defaults.monthlyHousingCost} required placeholder={f.housingCostPlaceholder} />
          </Field>
          <Field label={f.existingInstalments} htmlFor="existingLoanInstalments" hint={f.existingInstalmentsHint} required error={errorFor("existingLoanInstalments")}>
            <Input id="existingLoanInstalments" name="existingLoanInstalments" inputMode="decimal" defaultValue={defaults.existingLoanInstalments} required placeholder={f.existingInstalmentsPlaceholder} />
          </Field>
          <Field label={f.otherCosts} htmlFor="otherFixedCosts" required error={errorFor("otherFixedCosts")}>
            <Input id="otherFixedCosts" name="otherFixedCosts" inputMode="decimal" defaultValue={defaults.otherFixedCosts} required placeholder={f.otherCostsPlaceholder} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={b.title} description={b.intro} level={3} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={b.bankName} htmlFor="bankName" required error={errorFor("bankName")}>
            <Input id="bankName" name="bankName" defaultValue={defaults.bankName} required autoComplete="off" placeholder={b.bankNamePlaceholder} />
          </Field>
          <Field
            label={b.iban}
            htmlFor="iban"
            hint={defaults.maskedIban ? `${b.ibanStored} ${defaults.maskedIban}` : b.ibanHint}
            required
            error={errorFor("iban")}
          >
            <Input id="iban" name="iban" required autoComplete="off" spellCheck={false} placeholder="DE00 0000 0000 0000 0000 00" />
          </Field>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">{b.storageNotice}</p>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionHeading title={t.coBorrowerTitle} description={t.coBorrowerHint} level={3} />
        <div className="flex gap-3">
          <input
            type="checkbox"
            id="withCoBorrower"
            name="withCoBorrower"
            checked={withCoBorrower}
            onChange={(event) => setWithCoBorrower(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--accent)]"
          />
          <label htmlFor="withCoBorrower" className="text-sm">
            {t.coBorrowerQuestion}
          </label>
        </div>

        {withCoBorrower ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.firstName} htmlFor="coFirstName" required>
              <Input id="coFirstName" name="coFirstName" defaultValue={defaults.coBorrower?.firstName ?? ""} required placeholder={t.firstNamePlaceholder} />
            </Field>
            <Field label={t.lastName} htmlFor="coLastName" required>
              <Input id="coLastName" name="coLastName" defaultValue={defaults.coBorrower?.lastName ?? ""} required placeholder={t.lastNamePlaceholder} />
            </Field>
            <Field label={t.birthDate} htmlFor="coBirthDate" required>
              <Input id="coBirthDate" name="coBirthDate" type="date" defaultValue={defaults.coBorrower?.birthDate ?? ""} required />
            </Field>
            <Field label={t.email} htmlFor="coEmail" required>
              <Input id="coEmail" name="coEmail" type="email" defaultValue={defaults.coBorrower?.email ?? ""} required placeholder={t.emailPlaceholder} />
            </Field>
            <Field label={f.employmentType} htmlFor="coEmploymentType" required>
              <Select id="coEmploymentType" name="coEmploymentType" defaultValue={defaults.coBorrower?.employmentType ?? "PERMANENT"}>
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {dictionary.employment[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.netIncome} htmlFor="coNetMonthlyIncome" required>
              <Input id="coNetMonthlyIncome" name="coNetMonthlyIncome" inputMode="decimal" defaultValue={defaults.coBorrower?.netMonthlyIncome ?? ""} required placeholder={f.netIncomePlaceholder} />
            </Field>
          </div>
        ) : null}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.common.loading : dictionary.common.continue}
        </Button>
      </div>
    </form>
  );
}
