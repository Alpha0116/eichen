import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { setFaultMode } from "../../src/adapters/simulated/faults";
import { providers } from "../../src/adapters";
import { db } from "../../src/server/db";
import { createApplication, transition } from "../../src/server/services/application";
import { grantConsent } from "../../src/server/services/consent";
import { submitApplication } from "../../src/server/services/submission";
import {
  DocumentsIncompleteError,
  finaliseDecision,
  outstandingDocuments,
  returnForCorrection,
} from "../../src/server/services/backoffice";
import {
  ChargeDeclinedError,
  issueAccountFee,
  payAccountFee,
} from "../../src/server/services/accountFee";
import { requiredDocuments, reviewDocument, uploadDocument } from "../../src/server/services/documents";

/** A test card: a valid Luhn number that no issuer has ever handed out. */
const TEST_CARD = {
  number: "4111111111111111",
  holder: "Lena Brandt",
  expiryMonth: 12,
  expiryYear: new Date().getUTCFullYear() + 2,
  cvc: "123",
};


/**
 * What happens when things do not go smoothly.
 *
 * Two families of failure matter in this flow: a payment the borrower's bank
 * refuses, and a person trying to move a file somewhere it must not go. None
 * of them may leave the application stuck — each must leave a way forward, or
 * refuse loudly rather than half-succeed.
 */

assert.ok(
  (process.env.DATABASE_URL ?? "").includes("test"),
  "Run the integration suites with DATABASE_URL pointing at the test database",
);

before(() => setFaultMode("always"));
after(async () => {
  setFaultMode(null);
  await db.$disconnect();
});

const PDF = Buffer.from("%PDF-1.4 doc");

async function applicationWithApplicant(overrides: { amount?: number; termMonths?: number } = {}) {
  const { application } = await createApplication({
    amount: overrides.amount ?? 900_000,
    termMonths: overrides.termMonths ?? 36,
    purpose: "FREE_USE",
    locale: "de",
  });

  await db.applicant.create({
    data: {
      applicationId: application.id,
      role: "PRIMARY",
      firstName: "Nils",
      lastName: "Faber",
      birthDate: "1990-03-05",
      email: "nils@mail-test.com",
      phone: "+4915100000000",
      street: "Hauptstraße 1",
      postalCode: "10115",
      city: "Berlin",
      country: "DE",
      residentSinceMonths: 80,
      employmentType: "PERMANENT",
      employerName: "Werk",
      employedSinceMonths: 40,
      netMonthlyIncome: 330_000,
      otherMonthlyIncome: 0,
    },
  });

  await db.household.update({
    where: { applicationId: application.id },
    data: { monthlyHousingCost: 80_000, otherFixedCosts: 15_000 },
  });

  await grantConsent({
    applicationId: application.id,
    userId: null,
    purpose: "TERMS_AND_PRIVACY",
    locale: "de",
    granted: true,
  });

  return application;
}

async function withValidatedDocuments(applicationId: string) {
  for (const kind of await requiredDocuments(applicationId)) {
    const document = await uploadDocument({
      applicationId,
      kind,
      filename: `${kind}.pdf`,
      mimeType: "application/pdf",
      bytes: PDF,
    });
    await reviewDocument({ documentId: document.id, agentId: "agent-test", decision: "VALIDATED" });
  }
}

test("an amount above the catalogue is submitted rather than refused", async () => {
  // The amount is not a ground for refusal. A request well above what the
  // product describes is priced and queued like any other, because cutting it
  // or turning it down is an administrator's judgement — the funnel does not
  // make that decision on its own.
  const application = await applicationWithApplicant({ amount: 90_000_000 });

  await submitApplication(application.id);

  const row = await db.application.findUniqueOrThrow({
    where: { id: application.id },
    include: { offers: true },
  });
  assert.equal(row.state, "SUBMITTED", "the file reaches the queue");
  assert.equal(row.grantedAmount, 90_000_000, "the amount asked for is carried through");
  assert.equal(row.offers.length, 1, "and it was priced");
});

test("an incomplete file cannot be approved, and says which documents are missing", async () => {
  const application = await applicationWithApplicant();
  await submitApplication(application.id);

  // Nothing was uploaded, so every required kind is outstanding — and the
  // refusal carries the list, which is what the back office renders.
  const expected = await requiredDocuments(application.id);
  assert.ok(expected.length > 0);
  assert.deepEqual([...(await outstandingDocuments(application.id))].sort(), [...expected].sort());

  await assert.rejects(
    finaliseDecision(application.id, { agentId: "agent-test", outcome: "APPROVED" }),
    (error: unknown) => {
      assert.ok(error instanceof DocumentsIncompleteError);
      assert.deepEqual([...error.missing].sort(), [...expected].sort());
      return true;
    },
  );

  const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
  assert.equal(row.state, "SUBMITTED", "a refused approval leaves the file where it was");
});

test("approving a complete file generates the contract in the same act", async () => {
  const application = await applicationWithApplicant();
  await withValidatedDocuments(application.id);
  await submitApplication(application.id);
  assert.deepEqual(await outstandingDocuments(application.id), []);

  await finaliseDecision(application.id, { agentId: "agent-test", outcome: "APPROVED" });

  // The borrower must be able to carry on without anyone generating anything
  // else by hand: APPROVED with no contract is a dead end for them.
  const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
  assert.equal(row.state, "CONTRACT_READY");
  const contract = await db.contract.findFirstOrThrow({ where: { applicationId: application.id } });
  assert.equal(contract.status, "READY");
});

test("a file sent back for correction becomes editable again", async () => {
  const application = await applicationWithApplicant();
  await withValidatedDocuments(application.id);
  await submitApplication(application.id);

  await returnForCorrection(application.id, {
    agentId: "agent-test",
    reason: "Der Einkommensnachweis ist unvollständig.",
  });

  const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
  assert.equal(row.state, "DRAFT");

  // And it can go round again rather than being a dead end.
  await submitApplication(application.id);
  const resubmitted = await db.application.findUniqueOrThrow({ where: { id: application.id } });
  assert.equal(resubmitted.state, "SUBMITTED");

  const offers = await db.offer.findMany({ where: { applicationId: application.id } });
  assert.equal(offers.length, 1, "resubmission replaces the pricing rather than accumulating it");
});

test("a returned correction demands a reason the borrower can act on", async () => {
  const application = await applicationWithApplicant();
  await withValidatedDocuments(application.id);
  await submitApplication(application.id);

  await assert.rejects(
    returnForCorrection(application.id, { agentId: "agent-test", reason: "nein" }),
    /reason/i,
  );
});

test("a declined fee payment leaves the fee payable instead of stranding the file", async () => {
  const application = await applicationWithApplicant();
  await withValidatedDocuments(application.id);
  await submitApplication(application.id);
  await finaliseDecision(application.id, { agentId: "agent-test", outcome: "APPROVED" });

  // Reach FEE_PENDING without going through the signature provider, which has
  // its own forced failure under this fault mode.
  await transition(application.id, "SIGNED", "CUSTOMER");
  const fee = await issueAccountFee(application.id);

  await grantConsent({
    applicationId: application.id,
    userId: null,
    purpose: "ACCOUNT_FEE_TERMS",
    locale: "de",
    granted: true,
  });

  await assert.rejects(
    payAccountFee(application.id, { card: TEST_CARD }),
    ChargeDeclinedError,
  );

  const after = await db.accountFee.findUniqueOrThrow({ where: { id: fee.id } });
  assert.equal(after.status, "PENDING", "a decline must not mark the fee paid");
  assert.equal(after.paidAt, null);

  const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
  assert.equal(row.state, "FEE_PENDING", "the borrower can try again");
});

test("a one-off charge is idempotent on its reference", async () => {
  const registry = providers();
  const first = await registry.payments.charge(
    { applicationId: "app-fault-test", amount: 4_900, currency: "EUR", reference: "EG-TEST-0001", card: TEST_CARD },
    { idempotencyKey: "k", attempt: 1 },
  );
  const second = await registry.payments.charge(
    { applicationId: "app-fault-test", amount: 4_900, currency: "EUR", reference: "EG-TEST-0001", card: TEST_CARD },
    { idempotencyKey: "k", attempt: 2 },
  );

  assert.equal(first.status, "FAILED");
  assert.ok(first.declineCode);
  // The same reference returns the same outcome and the same provider id.
  assert.deepEqual(first, second);
});

test("a returned direct debit is recorded, not retried into a double debit", async () => {
  const registry = providers();
  const first = await registry.payments.collect(
    { loanId: "loan-fault-test", instalmentIndex: 1, amount: 25_000, currency: "EUR" },
    { idempotencyKey: "k", attempt: 1 },
  );
  const second = await registry.payments.collect(
    { loanId: "loan-fault-test", instalmentIndex: 1, amount: 25_000, currency: "EUR" },
    { idempotencyKey: "k", attempt: 2 },
  );

  assert.equal(first.status, "RETURNED");
  assert.ok(first.returnCode);
  // The same instalment returns the same outcome and the same reference.
  assert.deepEqual(first, second);
});
