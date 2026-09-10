import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { providers } from "../../adapters";
import type { Offer } from "../../domain/offers/types";
import { addDays } from "../../domain/finance/dates";
import { recordAudit } from "../audit";
import { CONTACT, PRODUCT, defaultInterestRate } from "../config";
import { db } from "../db";
import { fromJsonWithDates } from "../json";
import { idempotencyKey, withRetry } from "../providerCall";
import { getDictionary, toLocale } from "../../i18n";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "../../i18n/format";
import type { ContractData } from "./contractDocument";
import { appendSignaturePage, renderContractPdf, renderEsisPdf } from "./contractPdf";
import { StateConflictError, transition } from "./application";
import type { ApplicationState } from "../../domain/application/states";
import { assertConsents } from "./consent";
import { issueAccountFee } from "./accountFee";
import { notify } from "./notifications";

export class NoSelectedOfferError extends Error {
  constructor() {
    super("The application has no selected offer");
    this.name = "NoSelectedOfferError";
  }
}

function storageRoot(): string {
  return process.env.DOCUMENT_STORAGE_DIR ?? "./.storage/documents";
}

async function storeBytes(applicationId: string, name: string, bytes: Buffer): Promise<string> {
  const key = `${applicationId}/${name}`;
  await mkdir(join(storageRoot(), applicationId), { recursive: true });
  await writeFile(join(storageRoot(), key), bytes, { mode: 0o600 });
  return key;
}

async function readStored(key: string): Promise<Buffer> {
  return readFile(join(storageRoot(), key));
}

async function contractDataFor(applicationId: string): Promise<ContractData> {
  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { applicants: true, offers: { where: { selectedAt: { not: null } }, take: 1 } },
  });

  const offerRow = application.offers[0];
  if (!offerRow) throw new NoSelectedOfferError();

  const offer = fromJsonWithDates<Offer | null>(offerRow.payloadJson, null);
  if (!offer) throw new NoSelectedOfferError();

  const locale = toLocale(application.locale);
  const dictionary = getDictionary(locale);
  const primary = application.applicants.find((row) => row.role === "PRIMARY");
  const co = application.applicants.find((row) => row.role === "CO_BORROWER");

  return {
    reference: application.reference,
    parties: {
      lenderName: offer.lenderName,
      supervisionNote:
        (dictionary.lender.supervision as Record<string, string>)[
          offer.supervisionNote.replace("lender.supervision.", "")
        ] ?? "",
      borrowerName: primary ? `${primary.firstName} ${primary.lastName}` : "",
      borrowerAddress: primary ? `${primary.street}, ${primary.postalCode} ${primary.city}` : "",
      coBorrowerName: co ? `${co.firstName} ${co.lastName}` : null,
    },
    quote: offer.quote,
    insuranceSelected: offerRow.insuranceSelected,
    purposeLabel:
      (dictionary.purpose as Record<string, string>)[application.purpose] ?? application.purpose,
    contractDate: new Date(),
    withdrawalUntil: addDays(new Date(), PRODUCT.withdrawalDays),
    defaultInterestRate: defaultInterestRate(),
    locale,
  };
}

/**
 * Generates the contract and the pre-contractual information sheet.
 *
 * `documentHash` is taken over the exact bytes written. The signature envelope
 * later commits to that hash, which is what makes "this is the document you
 * signed" a checkable claim rather than an assertion.
 */
const CONTRACT_GENERATABLE_STATES = new Set<ApplicationState>(["APPROVED", "CONTRACT_READY"]);

export async function generateContract(applicationId: string) {
  // Checked before anything is written: the state transition at the end would
  // also refuse, but only after a new contract version had already been
  // persisted and a file written for an application that must not have one.
  const { state } = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { state: true },
  });
  if (!CONTRACT_GENERATABLE_STATES.has(state as ApplicationState)) {
    throw new StateConflictError(state as ApplicationState, "CONTRACT_READY", "NOT_ALLOWED");
  }

  const data = await contractDataFor(applicationId);
  const [contractPdf, esisPdf] = await Promise.all([
    renderContractPdf(data),
    renderEsisPdf(data),
  ]);

  const version =
    (await db.contract.count({ where: { applicationId } })) + 1;
  const documentHash = createHash("sha256").update(contractPdf).digest("hex");

  const [storageKey, preContractualStorageKey] = await Promise.all([
    storeBytes(applicationId, `contract-v${version}.pdf`, contractPdf),
    storeBytes(applicationId, `esis-v${version}.pdf`, esisPdf),
  ]);

  const contract = await db.contract.create({
    data: {
      applicationId,
      version,
      documentHash,
      storageKey,
      preContractualStorageKey,
      status: "READY",
    },
  });

  await recordAudit({
    applicationId,
    action: "contract_generated",
    actorType: "SYSTEM",
    payload: { contractId: contract.id, version, documentHash },
  });

  await transition(applicationId, "CONTRACT_READY", "SYSTEM");
  return contract;
}

/**
 * Opens the signing envelope for the contract as it currently stands.
 *
 * Idempotent on the document hash: reopening the page reuses the envelope
 * already bound to those exact bytes rather than minting a second one. A
 * regenerated contract has a different hash, so it gets its own envelope and
 * the old one can no longer be signed against the new text.
 */
export async function prepareSignature(applicationId: string) {
  await assertConsents(applicationId, "CONTRACT");

  const [contract, primary] = await Promise.all([
    db.contract.findFirstOrThrow({
      where: { applicationId },
      orderBy: { version: "desc" },
    }),
    db.applicant.findFirstOrThrow({ where: { applicationId, role: "PRIMARY" } }),
  ]);

  if (contract.envelopeId && contract.status === "READY") {
    return { contractId: contract.id, envelopeId: contract.envelopeId };
  }

  const registry = providers();
  const envelope = await withRetry(
    idempotencyKey("sign", contract.id, contract.documentHash),
    (meta) =>
      registry.signature.create(
        {
          applicationId,
          documentHash: contract.documentHash,
          signerName: `${primary.firstName} ${primary.lastName}`.trim(),
        },
        meta,
      ),
    { attempts: 2 },
  );

  await db.contract.update({
    where: { id: contract.id },
    data: { envelopeId: envelope.envelopeId, provider: registry.signature.name, status: "READY" },
  });

  return { contractId: contract.id, envelopeId: envelope.envelopeId };
}

export type SignResult =
  | { ok: true; signedAt: Date; withdrawalUntil: Date }
  | { ok: false; reason: "EMPTY_SIGNATURE" | "EXPIRED" | "FAILED" };

/**
 * Completes the signature.
 *
 * The withdrawal period is set here, at the moment the contract is concluded,
 * rather than when it was generated — a draft that sat unsigned for a week must
 * not eat into the borrower's fourteen days.
 */
export async function signContract(
  applicationId: string,
  signatureImage: Buffer,
): Promise<SignResult> {
  const contract = await db.contract.findFirstOrThrow({
    where: { applicationId },
    orderBy: { version: "desc" },
  });
  if (!contract.envelopeId) return { ok: false, reason: "FAILED" };

  const registry = providers();
  const envelope = await registry.signature.sign(
    { envelopeId: contract.envelopeId, signatureImage },
    { idempotencyKey: idempotencyKey("sign-submit", contract.id), attempt: 1 },
  );

  if (envelope.status !== "SIGNED") {
    await db.contract.update({
      where: { id: contract.id },
      data: { status: envelope.status },
    });
    return {
      ok: false,
      // A blank canvas comes back FAILED from the provider, which is a thing
      // the borrower can fix by drawing; an expired envelope is not.
      reason: envelope.status === "EXPIRED" ? "EXPIRED" : "EMPTY_SIGNATURE",
    };
  }

  // The drawing is kept beside the contract it belongs to, under the same
  // 0600 storage the documents use. The row holds its key and its hash; the
  // bytes never enter the database.
  const signatureStorageKey = await storeBytes(
    applicationId,
    `signature-v${contract.version}.png`,
    signatureImage,
  );

  const signedAt = new Date(envelope.signedAt!);
  const withdrawalUntil = addDays(signedAt, PRODUCT.withdrawalDays);

  // The signed copy is the deed that was presented with a signature page added
  // to it, never a fresh rendering: the pages above the signature stay the
  // exact bytes `documentHash` was taken over, so the hash on the signature
  // page still verifies against the file the borrower downloads. The original
  // is left on disk untouched under its own key for the same reason.
  const [primary, signedApplication] = await Promise.all([
    db.applicant.findFirstOrThrow({ where: { applicationId, role: "PRIMARY" } }),
    db.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { locale: true, reference: true },
    }),
  ]);
  const signedPdf = await appendSignaturePage(
    await readStored(contract.storageKey),
    {
      reference: signedApplication.reference,
      signerName: `${primary.firstName} ${primary.lastName}`.trim(),
      signedAt,
      image: signatureImage,
      documentHash: contract.documentHash,
      signatureHash: envelope.signatureHash!,
      evidenceHash: envelope.evidenceHash!,
    },
    toLocale(signedApplication.locale),
  );
  const signedStorageKey = await storeBytes(
    applicationId,
    `contract-v${contract.version}-signed.pdf`,
    signedPdf,
  );

  await db.contract.update({
    where: { id: contract.id },
    data: {
      status: "SIGNED",
      signedAt,
      evidenceHash: envelope.evidenceHash,
      signatureHash: envelope.signatureHash,
      signatureStorageKey,
      signedStorageKey,
      withdrawalUntil,
    },
  });

  await recordAudit({
    applicationId,
    action: "contract_signed",
    actorType: "CUSTOMER",
    payload: {
      contractId: contract.id,
      documentHash: contract.documentHash,
      evidenceHash: envelope.evidenceHash,
      signatureHash: envelope.signatureHash,
      provider: registry.signature.name,
    },
  });

  await transition(applicationId, "SIGNED", "CUSTOMER");

  // Tell the back office. A signature is the point at which a person has to
  // pick the file up again — the fee is issued automatically below, but the
  // payout that follows it is a human decision. `notify` swallows provider
  // failures by design, so a mail outage cannot roll back a signed contract.
  const signed = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: {
      reference: true,
      locale: true,
      purpose: true,
      bankName: true,
      maskedIban: true,
      applicants: { where: { role: "PRIMARY" }, take: 1 },
      offers: { where: { selectedAt: { not: null } }, take: 1 },
    },
  });
  const borrower = signed.applicants[0];
  const offerRow = signed.offers[0];
  const offer = offerRow ? fromJsonWithDates<Offer | null>(offerRow.payloadJson, null) : null;
  const opsLocale = toLocale(signed.locale);
  const dictionary = getDictionary(opsLocale);
  const quote = offer?.quote;
  const insured = Boolean(offerRow?.insuranceSelected && quote?.withInsurance);
  const variant = insured ? quote!.withInsurance! : quote?.base;

  /** Money and rates only exist if the offer could be read back. */
  const money = (minor: number | undefined) =>
    minor === undefined ? "—" : formatMoney(minor, opsLocale, quote?.currency ?? "EUR");
  const rate = (value: number | undefined) =>
    value === undefined ? "—" : formatPercent(value, opsLocale);

  // The whole file, in one message.
  //
  // The recipient is the operator's own address, configured in the
  // environment, and the point of the mail is that somebody can pick the case
  // up from their inbox without opening the back office first. The account
  // number is the only thing that stays partly hidden, and only because the
  // full one is never stored anywhere in this system.
  await notify({
    applicationId,
    channel: "EMAIL",
    to: CONTACT.opsEmail,
    // The sender is the configured mailbox — mail cannot claim to come from
    // the borrower without failing the receiving side's checks — but a reply
    // reaches them directly, which is what an operator actually needs.
    replyTo: borrower?.email,
    template: "contract_signed_ops",
    locale: opsLocale,
    variables: {
      reference: signed.reference,
      borrower: borrower ? `${borrower.firstName} ${borrower.lastName}`.trim() : "—",
      birthDate: borrower?.birthDate ?? "—",
      email: borrower?.email ?? "—",
      phone: borrower?.phone ?? "—",
      address: borrower
        ? `${borrower.street}, ${borrower.postalCode} ${borrower.city} (${borrower.country})`
        : "—",
      employment: borrower
        ? ((dictionary.employment as Record<string, string>)[borrower.employmentType] ??
          borrower.employmentType)
        : "—",
      employer: borrower?.employerName || "—",
      income: borrower ? formatMoney(borrower.netMonthlyIncome, opsLocale) : "—",
      otherIncome: borrower ? formatMoney(borrower.otherMonthlyIncome, opsLocale) : "—",
      purpose:
        (dictionary.purpose as Record<string, string>)[signed.purpose] ?? signed.purpose,
      amount: money(quote?.netAmount),
      term: quote ? String(quote.termMonths) : "—",
      instalment: money(variant?.instalment),
      nominalRate: rate(quote?.nominalAnnualRate),
      effectiveRate: rate(quote?.effectiveAnnualRate),
      totalPayable: money(variant?.totalPayable),
      insurance: insured ? money(quote!.withInsurance!.premium) : "—",
      bank: signed.bankName ?? "—",
      maskedIban: signed.maskedIban ?? "—",
      withdrawalUntil: formatDate(withdrawalUntil, opsLocale),
      signedAt: formatDateTime(signedAt, opsLocale),
      documentHash: contract.documentHash,
      signatureHash: envelope.signatureHash ?? "—",
    },
  });

  // Signing is what makes the fee due, so it is issued here rather than left
  // to whichever page the borrower happens to open next: an application that
  // is signed but carries no fee row would show them a step with nothing to
  // pay.
  await issueAccountFee(applicationId);

  return { ok: true, signedAt, withdrawalUntil };
}

export async function withdrawContract(applicationId: string, actorId: string | null) {
  const contract = await db.contract.findFirstOrThrow({
    where: { applicationId },
    orderBy: { version: "desc" },
  });

  if (!contract.withdrawalUntil || contract.withdrawalUntil < new Date()) {
    throw new Error("The statutory withdrawal period has ended");
  }

  await recordAudit({
    applicationId,
    action: "credit_decision_final",
    actorType: "CUSTOMER",
    actorId,
    payload: { outcome: "WITHDRAWN", contractId: contract.id, statutory: true },
  });

  await transition(applicationId, "WITHDRAWN", "CUSTOMER", {
    actorId,
    reason: "statutory_withdrawal",
  });
}

export async function latestContract(applicationId: string) {
  return db.contract.findFirst({ where: { applicationId }, orderBy: { version: "desc" } });
}
