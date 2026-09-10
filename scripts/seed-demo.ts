import { db } from "../src/server/db";
import { createApplication, transition } from "../src/server/services/application";
import { grantConsent } from "../src/server/services/consent";
import { submitApplication } from "../src/server/services/submission";
import { requiredDocuments, reviewDocument, uploadDocument } from "../src/server/services/documents";
import { prepareSignature, signContract } from "../src/server/services/contract";
import { finaliseDecision, returnForCorrection } from "../src/server/services/backoffice";
import { payAccountFee } from "../src/server/services/accountFee";
import { collectDueInstalments, disburse } from "../src/server/services/servicing";
import { recordSimulation } from "../src/server/services/simulation";
import { addMonths } from "../src/domain/finance/dates";
import { setFaultMode } from "../src/adapters/simulated/faults";

// The demo data set must come out the same every time. Fault injection stays
// on for the running application, where a failure is something the funnel
// should handle; here it would just make the seed unreproducible.
setFaultMode("off");

/**
 * Builds a demonstration data set: applications sitting at every interesting
 * point of the funnel, so the back-office queue, the KPI page and the customer
 * area all have something real to show.
 *
 * Re-runnable. It only ever adds; it deletes nothing.
 */

interface Fixture {
  firstName: string;
  lastName: string;
  postalCode: string;
  city: string;
  birthDate: string;
  income: number;
  employmentType: string;
  employedSinceMonths: number;
  housing: number;
  existingLoans: number;
  children: number;
  amount: number;
  termMonths: number;
  purpose: "FREE_USE" | "VEHICLE" | "RENOVATION" | "DEBT_CONSOLIDATION";
  schufaOptIn: boolean;
}

const FIXTURES: Record<string, Fixture> = {
  disbursed: {
    firstName: "Lena", lastName: "Brandt", postalCode: "10115", city: "Berlin",
    birthDate: "1988-04-17", income: 340_000, employmentType: "PERMANENT",
    employedSinceMonths: 72, housing: 85_000, existingLoans: 0, children: 0,
    amount: 1_200_000, termMonths: 48, purpose: "RENOVATION", schufaOptIn: true,
  },
  awaitingFee: {
    firstName: "Jonas", lastName: "Keller", postalCode: "20095", city: "Hamburg",
    birthDate: "1992-09-02", income: 295_000, employmentType: "PERMANENT",
    employedSinceMonths: 30, housing: 92_000, existingLoans: 12_000, children: 1,
    amount: 800_000, termMonths: 36, purpose: "VEHICLE", schufaOptIn: false,
  },
  awaitingSignature: {
    firstName: "Mira", lastName: "Neumann", postalCode: "50667", city: "Köln",
    birthDate: "1985-01-23", income: 410_000, employmentType: "CIVIL_SERVANT",
    employedSinceMonths: 120, housing: 110_000, existingLoans: 0, children: 2,
    amount: 1_500_000, termMonths: 60, purpose: "DEBT_CONSOLIDATION", schufaOptIn: true,
  },
  awaitingDecision: {
    firstName: "Tobias", lastName: "Vogel", postalCode: "80331", city: "München",
    birthDate: "1979-11-08", income: 260_000, employmentType: "SELF_EMPLOYED",
    employedSinceMonths: 44, housing: 130_000, existingLoans: 35_000, children: 1,
    amount: 600_000, termMonths: 24, purpose: "FREE_USE", schufaOptIn: false,
  },
  returned: {
    firstName: "Sara", lastName: "Hoffmann", postalCode: "60311", city: "Frankfurt",
    birthDate: "1995-06-30", income: 215_000, employmentType: "FIXED_TERM",
    employedSinceMonths: 9, housing: 78_000, existingLoans: 8_000, children: 0,
    amount: 450_000, termMonths: 36, purpose: "FREE_USE", schufaOptIn: false,
  },
  declined: {
    firstName: "Paul", lastName: "Sommer", postalCode: "04109", city: "Leipzig",
    birthDate: "1998-02-14", income: 148_000, employmentType: "PROBATION",
    employedSinceMonths: 3, housing: 70_000, existingLoans: 24_000, children: 1,
    amount: 900_000, termMonths: 24, purpose: "FREE_USE", schufaOptIn: true,
  },
  draft: {
    firstName: "Elif", lastName: "Lorenz", postalCode: "70173", city: "Stuttgart",
    birthDate: "1990-08-11", income: 305_000, employmentType: "PERMANENT",
    employedSinceMonths: 55, housing: 95_000, existingLoans: 0, children: 0,
    amount: 700_000, termMonths: 48, purpose: "FURNITURE" as Fixture["purpose"], schufaOptIn: false,
  },
};

const PDF = Buffer.from("%PDF-1.4 demo document");

/** Stands in for the stroke a borrower draws, past the provider's minimum. */
const SIGNATURE_PNG = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  Buffer.alloc(1024, 7),
]);

async function build(fixture: Fixture, userId: string | null) {
  const { simulation } = await recordSimulation({
    amount: fixture.amount,
    termMonths: fixture.termMonths,
    purpose: fixture.purpose,
    locale: "de",
  });

  const { application } = await createApplication({
    amount: fixture.amount,
    termMonths: fixture.termMonths,
    purpose: fixture.purpose,
    locale: "de",
    userId,
    simulationId: simulation.id,
  });

  await db.applicant.create({
    data: {
      applicationId: application.id,
      role: "PRIMARY",
      firstName: fixture.firstName,
      lastName: fixture.lastName,
      birthDate: fixture.birthDate,
      email: `${fixture.firstName.toLowerCase()}@mail-test.com`,
      phone: "+4915100000000",
      street: "Hauptstraße 1",
      postalCode: fixture.postalCode,
      city: fixture.city,
      country: "DE",
      residentSinceMonths: 60,
      employmentType: fixture.employmentType,
      employerName: fixture.employmentType === "SELF_EMPLOYED" ? null : "Werk GmbH",
      employedSinceMonths: fixture.employedSinceMonths,
      netMonthlyIncome: fixture.income,
      otherMonthlyIncome: 0,
    },
  });

  await db.household.update({
    where: { applicationId: application.id },
    data: {
      adults: 1,
      children: fixture.children,
      housingStatus: "RENT",
      monthlyHousingCost: fixture.housing,
      existingLoanInstalments: fixture.existingLoans,
      otherFixedCosts: 15_000,
    },
  });

  await db.application.update({
    where: { id: application.id },
    data: {
      bankName: "Stadtsparkasse",
      maskedIban: "DE89 •••• •••• 3000",
      schufaOptIn: fixture.schufaOptIn,
    },
  });

  return application;
}

async function consent(applicationId: string, purpose: "TERMS_AND_PRIVACY" | "PRECONTRACTUAL_INFO" | "ACCOUNT_FEE_TERMS") {
  await grantConsent({ applicationId, userId: null, purpose, locale: "de", granted: true });
}

async function uploadAll(applicationId: string, validate: boolean) {
  for (const kind of await requiredDocuments(applicationId)) {
    const document = await uploadDocument({
      applicationId,
      kind,
      filename: `${kind.toLowerCase()}.pdf`,
      mimeType: "application/pdf",
      bytes: PDF,
    });
    if (validate) {
      await reviewDocument({ documentId: document.id, agentId: "seed", decision: "VALIDATED" });
    }
  }
}

/** Drives an application up to (and including) the given stage. */
async function advanceTo(
  applicationId: string,
  stage: "submitted" | "approved" | "signed" | "feePaid" | "disbursed",
) {
  await consent(applicationId, "TERMS_AND_PRIVACY");
  await uploadAll(applicationId, true);
  await submitApplication(applicationId);
  if (stage === "submitted") return;

  await finaliseDecision(applicationId, { agentId: "seed", outcome: "APPROVED" });
  if (stage === "approved") return;

  await consent(applicationId, "PRECONTRACTUAL_INFO");
  await prepareSignature(applicationId);
  await signContract(applicationId, SIGNATURE_PNG);
  if (stage === "signed") return;

  await consent(applicationId, "ACCOUNT_FEE_TERMS");
  await payAccountFee(applicationId, {
    card: {
      number: "4111111111111111",
      holder: "Demo Kundin",
      expiryMonth: 12,
      expiryYear: new Date().getUTCFullYear() + 2,
      cvc: "123",
    },
  });
  if (stage === "feePaid") return;

  const loan = await disburse(applicationId, { agentId: "seed" });
  // Three months of collected instalments, so the customer area and the KPI
  // page have a repayment history rather than an empty schedule.
  for (let month = 0; month < 3; month += 1) {
    const due = await db.instalment.findFirst({
      where: { loanId: loan.id, status: "SCHEDULED" },
      orderBy: { index: "asc" },
    });
    if (!due) break;
    await collectDueInstalments(addMonths(due.dueDate, 0));
  }
}

async function main() {
  // Every application belongs to the demo customer: the flow has no anonymous
  // path, so an ownerless file would only be a row nobody can open.
  const customer = await db.user.findUnique({ where: { email: "kundin@eichen-kredit.com" } });
  const userId = customer?.id ?? null;

  const disbursed = await build(FIXTURES.disbursed, userId);
  await advanceTo(disbursed.id, "disbursed");

  const awaitingFee = await build(FIXTURES.awaitingFee, userId);
  await advanceTo(awaitingFee.id, "signed");

  const awaitingSignature = await build(FIXTURES.awaitingSignature, userId);
  await advanceTo(awaitingSignature.id, "approved");

  const awaitingDecision = await build(FIXTURES.awaitingDecision, userId);
  await advanceTo(awaitingDecision.id, "submitted");

  // Sent back for correction: the borrower can edit and resubmit.
  const returned = await build(FIXTURES.returned, userId);
  await advanceTo(returned.id, "submitted");
  await returnForCorrection(returned.id, {
    agentId: "seed",
    reason: "Der Einkommensnachweis ist unleserlich. Bitte laden Sie ihn erneut hoch.",
  });

  const declined = await build(FIXTURES.declined, userId);
  await advanceTo(declined.id, "submitted");
  await finaliseDecision(declined.id, {
    agentId: "seed",
    outcome: "DECLINED",
    reason: "Haushaltsbudget trägt die Rate nicht.",
  });

  // A draft with everything filled in but not yet submitted, and one that has
  // expired, so the queue and the sweeper both have something to show.
  const draft = await build(FIXTURES.draft, userId);
  await uploadAll(draft.id, false);

  const expired = await build({ ...FIXTURES.draft, firstName: "Rana", lastName: "Kolb" }, userId);
  await transition(expired.id, "EXPIRED", "SYSTEM", { reason: "stale_draft" });

  const counts = await db.application.groupBy({ by: ["state"], _count: true });
  console.log("Demo applications by state:");
  for (const row of counts) console.log(`  ${row.state}: ${row._count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
