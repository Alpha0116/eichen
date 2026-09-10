import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { after, test } from "node:test";
import { db } from "../../src/server/db";
import { verifyApplicationChain } from "../../src/server/audit";
import { createApplication, transition } from "../../src/server/services/application";
import { grantConsent } from "../../src/server/services/consent";
import { submitApplication } from "../../src/server/services/submission";
import { offerFor } from "../../src/server/services/offers";
import {
  documentsComplete,
  requiredDocuments,
  reviewDocument,
  uploadDocument,
} from "../../src/server/services/documents";
import { prepareSignature, signContract } from "../../src/server/services/contract";
import { finaliseDecision, latestDecision } from "../../src/server/services/backoffice";
import { accountFee, payAccountFee } from "../../src/server/services/accountFee";
import {
  acceptSettlement,
  collectDueInstalments,
  disburse,
  quoteSettlement,
} from "../../src/server/services/servicing";
import { setFaultMode } from "../../src/adapters/simulated/faults";
import { accountFeeFor, PRODUCT } from "../../src/server/config";
import { addMonths } from "../../src/domain/finance/dates";

// Guard: this suite writes real rows, so it must never run against the
// development database.
assert.ok(
  (process.env.DATABASE_URL ?? "").includes("test"),
  "Run the journey suite with DATABASE_URL pointing at the test database",
);

// The happy path must be deterministic. Provider failures get their own
// suite, where they are forced rather than left to chance.
setFaultMode("off");

after(async () => {
  setFaultMode(null);
  await db.$disconnect();
});

const DOCUMENT_BYTES = Buffer.from("%PDF-1.4 payslip");

/**
 * A stand-in for the stroke a borrower draws.
 *
 * A real, decodable PNG rather than a header with padding behind it: the
 * signed contract embeds the drawing, so a fixture that no decoder accepts
 * would exercise the fallback path instead of the one borrowers walk. Sized
 * past the provider's minimum, which exists so an untouched canvas cannot
 * count as a signature.
 */
function drawnSignature(): Buffer {
  const width = 480;
  const height = 140;
  // One filter byte per row, then RGBA pixels: a wavy, softly edged stroke on
  // a transparent ground, which is what a signature pad produces — and which
  // does not compress down past the provider's minimum the way a hard-edged
  // straight line would.
  const raw = Buffer.alloc(height * (1 + width * 4));
  let seed = 7;
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      const wave = height / 2 + Math.sin((x / width) * Math.PI * 4) * (height / 3);
      const distance = Math.abs(wave - y);
      if (distance >= 3.5) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const alpha = Math.max(60, 255 - Math.round(distance * 60) - (seed % 40));
      raw.writeUInt32BE(0x12103a00 | alpha, row + 1 + x * 4);
    }
  }

  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const SIGNATURE_PNG = drawnSignature();

/** A test card: a valid Luhn number that no issuer has ever handed out. */
const TEST_CARD = {
  number: "4111111111111111",
  holder: "Lena Brandt",
  expiryMonth: 12,
  expiryYear: new Date().getUTCFullYear() + 2,
  cvc: "123",
};


test("a borrower goes from application to a fully repaid loan", async (t) => {
  // --- Step 1: the application -------------------------------------------
  const { application } = await createApplication({
    amount: 1_200_000,
    termMonths: 48,
    purpose: "RENOVATION",
    locale: "de",
  });

  await db.applicant.create({
    data: {
      applicationId: application.id,
      role: "PRIMARY",
      firstName: "Lena",
      lastName: "Brandt",
      birthDate: "1988-04-17",
      email: "lena@mail-test.com",
      phone: "+4915112345678",
      street: "Lindenstraße 4",
      postalCode: "10115",
      city: "Berlin",
      country: "DE",
      residentSinceMonths: 120,
      employmentType: "PERMANENT",
      employerName: "Stadtwerke",
      employedSinceMonths: 60,
      netMonthlyIncome: 340_000,
      otherMonthlyIncome: 0,
    },
  });

  await db.household.update({
    where: { applicationId: application.id },
    data: {
      adults: 1,
      children: 0,
      housingStatus: "RENT",
      monthlyHousingCost: 85_000,
      existingLoanInstalments: 0,
      otherFixedCosts: 20_000,
    },
  });

  await db.application.update({
    where: { id: application.id },
    data: { bankName: "Stadtsparkasse", maskedIban: "DE89 •••• •••• 3000", schufaOptIn: true },
  });

  await grantConsent({
    applicationId: application.id,
    userId: null,
    purpose: "TERMS_AND_PRIVACY",
    locale: "de",
    granted: true,
  });

  // Documents come before submission: an administrator decides on a complete
  // file, so there is nothing to review without them.
  const required = await requiredDocuments(application.id);
  await t.test("the file asks for identity, address, income and account proof", () => {
    assert.deepEqual(
      [...required].sort(),
      ["BANK_STATEMENT", "ID_BACK", "ID_FRONT", "PAYSLIP", "PROOF_OF_ADDRESS"],
    );
  });

  for (const kind of required) {
    const document = await uploadDocument({
      applicationId: application.id,
      kind,
      filename: `${kind}.pdf`,
      mimeType: "application/pdf",
      bytes: DOCUMENT_BYTES,
    });
    await reviewDocument({ documentId: document.id, agentId: "agent-test", decision: "VALIDATED" });
  }
  assert.equal(await documentsComplete(application.id), true);

  await t.test("a malformed upload is refused before it is stored", async () => {
    await assert.rejects(
      uploadDocument({
        applicationId: application.id,
        kind: "OTHER",
        filename: "note.txt",
        mimeType: "text/plain",
        bytes: Buffer.from("hello"),
      }),
      /fileType/,
    );
  });

  // --- Step 1 → 2: submission --------------------------------------------
  const { decision, offerSet } = await submitApplication(application.id);

  await t.test("submission prices one offer at the single 3 % rate", () => {
    assert.equal(offerSet.offers.length, 1);
    const [offer] = offerSet.offers;
    assert.equal(offer.nominalAnnualRate, PRODUCT.referenceRate);
    assert.equal(offer.nominalAnnualRate, 0.03);
    assert.equal(offer.commissionBps, 0);
    assert.equal(offer.sponsored, false);
    // The APR sits marginally above the nominal rate because payments fall
    // through the year, never below it.
    assert.ok(offer.quote.effectiveAnnualRate >= offer.nominalAnnualRate);
  });

  await t.test("the offer is already selected, since there is nothing to choose", async () => {
    const chosen = await offerFor(application.id);
    assert.ok(chosen);
    assert.ok(chosen!.row.selectedAt);
  });

  await t.test("the rule evaluation is recorded as advice, not as a decision", async () => {
    const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    assert.equal(row.state, "SUBMITTED");
    assert.ok(row.submittedAt);
    assert.equal(row.decidedAt, null);

    // No bureau is queried, so the bureau facts are unknown and the engine
    // closes to REFER rather than inventing a verdict.
    const stored = await latestDecision(application.id);
    assert.ok(stored);
    assert.equal(stored!.outcome, decision.outcome);
    assert.equal(stored!.ruleSetVersion, 1);
    assert.ok(stored!.firedRules.length > 0);
  });

  await t.test("no automated path can approve an application", async () => {
    await assert.rejects(
      transition(application.id, "APPROVED", "SYSTEM"),
      /ACTOR_FORBIDDEN/,
      "only an agent may approve",
    );
  });

  // --- Step 2 → 3: an administrator decides -------------------------------
  await finaliseDecision(application.id, { agentId: "agent-test", outcome: "APPROVED" });

  await t.test("approving generates the contract in the same act", async () => {
    const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    assert.equal(row.state, "CONTRACT_READY");
    assert.ok(row.decidedAt);
    const contract = await db.contract.findFirstOrThrow({ where: { applicationId: application.id } });
    assert.equal(contract.status, "READY");
  });

  // --- Step 3: signature --------------------------------------------------
  await grantConsent({
    applicationId: application.id,
    userId: null,
    purpose: "PRECONTRACTUAL_INFO",
    locale: "de",
    granted: true,
  });
  const envelope = await prepareSignature(application.id);
  assert.ok(envelope.envelopeId);

  await t.test("an untouched canvas does not sign the contract", async () => {
    const failed = await signContract(application.id, Buffer.alloc(16));
    if (failed.ok) assert.fail("an empty drawing must not produce a signature");
    assert.equal(failed.reason, "EMPTY_SIGNATURE");
  });

  const signed = await signContract(application.id, SIGNATURE_PNG);
  assert.ok(signed.ok);

  await t.test("the drawing is stored and bound to the document", async () => {
    const row = await db.contract.findFirstOrThrow({
      where: { applicationId: application.id },
      orderBy: { version: "desc" },
    });
    assert.equal(row.status, "SIGNED");
    assert.ok(row.signatureStorageKey, "the stroke is kept in the object store");
    assert.ok(row.signatureHash, "and its hash on the row");
    assert.ok(row.evidenceHash);
    // The proof commits to the drawing, so it cannot be the drawing's own hash.
    assert.notEqual(row.evidenceHash, row.signatureHash);
  });

  await t.test("the withdrawal period starts at signature", () => {
    assert.ok(signed.ok);
    if (!signed.ok) return;
    const days = (signed.withdrawalUntil.getTime() - signed.signedAt.getTime()) / 86_400_000;
    assert.ok(Math.abs(days - 14) < 0.01);
  });

  // --- Step 4: the account fee -------------------------------------------
  await t.test("signing issues the fee, computed from the granted amount", async () => {
    const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    assert.equal(row.state, "FEE_PENDING");

    const fee = await accountFee(application.id);
    assert.ok(fee);
    assert.equal(fee!.status, "PENDING");
    assert.equal(fee!.amount, accountFeeFor(row.grantedAmount ?? row.amount));
  });

  await t.test("the fee cannot be paid without the fee consent", async () => {
    await assert.rejects(
      payAccountFee(application.id, { card: TEST_CARD }),
      /ACCOUNT_FEE_TERMS/,
    );
  });

  await grantConsent({
    applicationId: application.id,
    userId: null,
    purpose: "ACCOUNT_FEE_TERMS",
    locale: "de",
    granted: true,
  });
  await payAccountFee(application.id, { card: TEST_CARD });

  await t.test("paying twice settles once", async () => {
    const before = await accountFee(application.id);
    await payAccountFee(application.id, { card: TEST_CARD });
    const afterSecond = await accountFee(application.id);
    assert.equal(afterSecond!.paidAt?.getTime(), before!.paidAt?.getTime());
    assert.equal(afterSecond!.status, "PAID");

    const row = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    assert.equal(row.state, "FEE_PAID");
  });

  // --- Step 5: disbursement ----------------------------------------------
  const loan = await disburse(application.id, { agentId: "agent-test" });

  await t.test("the payout goes to the account on the file", () => {
    // Nobody retypes an account number at the payout desk: the loan has to
    // carry the one the borrower entered with the rest of their details.
    assert.equal(loan.maskedIban, "DE89 •••• •••• 3000");
  });

  await t.test("the loan schedule matches the contract figures", async () => {
    const instalments = await db.instalment.findMany({
      where: { loanId: loan.id },
      orderBy: { index: "asc" },
    });
    assert.equal(instalments.length, 48);
    assert.equal(instalments.at(-1)!.closingBalance, 0);
    assert.equal(
      instalments.reduce((sum, row) => sum + row.principal, 0),
      loan.financedCapital,
    );
    assert.equal(loan.nominalAnnualRate, 0.03);
  });

  // --- Servicing ---------------------------------------------------------
  await t.test("collecting twice on the same day does not debit twice", async () => {
    const firstDue = await db.instalment.findFirstOrThrow({
      where: { loanId: loan.id, index: 1 },
    });
    const asOf = addMonths(firstDue.dueDate, 0);
    await collectDueInstalments(asOf);
    await collectDueInstalments(asOf);

    const payments = await db.payment.findMany({
      where: { loanId: loan.id, instalmentId: firstDue.id },
    });
    assert.equal(payments.length, 1);
  });

  // --- Early repayment ---------------------------------------------------
  await t.test("the early settlement respects the statutory cap", async () => {
    const paid = await db.instalment.count({ where: { loanId: loan.id, status: "PAID" } });
    const { settlement } = await quoteSettlement(loan.id, new Date());
    assert.ok(settlement.outstandingPrincipal > 0);
    assert.ok(settlement.compensation <= Math.round(settlement.outstandingPrincipal * 0.01));
    assert.ok(settlement.compensation <= settlement.interestSaved);
    assert.equal(settlement.remainingTermMonths, 48 - paid);
  });

  const { record } = await quoteSettlement(loan.id, new Date());
  await acceptSettlement(record.id);

  await t.test("accepting the settlement closes the loan and the application", async () => {
    const closed = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
    assert.equal(closed.status, "CLOSED");
    const app = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    assert.equal(app.state, "CLOSED");
  });

  // --- Audit -------------------------------------------------------------
  await t.test("the audit chain covers the journey and verifies", async () => {
    const chain = await verifyApplicationChain(application.id);
    assert.equal(chain.valid, true);
    assert.ok(chain.count > 15);

    const entries = await db.auditEntry.findMany({
      where: { applicationId: application.id },
      orderBy: { sequence: "asc" },
    });
    const actions = new Set(entries.map((row) => row.action));
    for (const expected of [
      "application_created",
      "document_uploaded",
      "document_reviewed",
      "application_submitted",
      "credit_decision_final",
      "contract_generated",
      "contract_signed",
      "account_fee_issued",
      "account_fee_paid",
      "disbursed",
      "payment_recorded",
      "settlement_quoted",
      "loan_closed",
    ]) {
      assert.ok(actions.has(expected), `missing audit action ${expected}`);
    }
  });

  await t.test("the audit trail never carries an IBAN or a birth date", async () => {
    const entries = await db.auditEntry.findMany({ where: { applicationId: application.id } });
    for (const entry of entries) {
      assert.ok(!/DE\d{2}\s?\d{4}/.test(entry.payloadJson), `raw IBAN in ${entry.action}`);
      assert.ok(!entry.payloadJson.includes("1988-04-17"), `birth date in ${entry.action}`);
    }
  });
});
