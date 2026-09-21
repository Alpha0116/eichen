import { createHash, randomUUID } from "node:crypto";
import { recordAudit } from "../audit";
import { UPLOAD } from "../config";
import { db } from "../db";
import { writeStored } from "../storage";

export const DOCUMENT_KINDS = [
  "ID_FRONT",
  "ID_BACK",
  "PROOF_OF_ADDRESS",
  "PAYSLIP",
  "BANK_STATEMENT",
  "TAX_ASSESSMENT",
  "OTHER",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const REJECTION_CODES = [
  "unreadable",
  "incomplete",
  "outdated",
  "wrong_document",
  "mismatch",
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export class UploadRejected extends Error {
  constructor(public readonly code: "fileTooLarge" | "fileType" | "malware") {
    super(code);
    this.name = "UploadRejected";
  }
}

/**
 * Stand-in for the malware scanner every upload must pass before it is stored.
 *
 * It looks for the EICAR test string, which is the one payload a scanner is
 * guaranteed to flag, so the reject path can be exercised end to end without
 * anything dangerous ever existing on disk.
 */
function scanForMalware(bytes: Buffer): boolean {
  return bytes.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));
}

export interface UploadInput {
  applicationId: string;
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  replacesId?: string | null;
}

/**
 * Accepts one document.
 *
 * The bytes go to the object store; the database keeps the key and the SHA-256
 * digest only. Nothing about the file's contents is logged, and the audit entry
 * records the digest rather than the name a borrower may have typed their
 * salary into.
 */
export async function uploadDocument(input: UploadInput) {
  if (input.bytes.byteLength > UPLOAD.maxBytes) throw new UploadRejected("fileTooLarge");
  if (!(UPLOAD.allowedMimeTypes as readonly string[]).includes(input.mimeType)) {
    throw new UploadRejected("fileType");
  }
  if (scanForMalware(input.bytes)) throw new UploadRejected("malware");

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const storageKey = `${input.applicationId}/${randomUUID()}`;
  await writeStored(storageKey, input.bytes);

  const document = await db.document.create({
    data: {
      applicationId: input.applicationId,
      kind: input.kind,
      filename: input.filename.slice(0, 200),
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      storageKey,
      sha256,
      status: "RECEIVED",
    },
  });

  if (input.replacesId) {
    await db.document.update({
      where: { id: input.replacesId },
      data: { replacedById: document.id },
    });
  }

  await recordAudit({
    applicationId: input.applicationId,
    action: "document_uploaded",
    actorType: "CUSTOMER",
    payload: {
      documentId: document.id,
      kind: input.kind,
      sizeBytes: input.bytes.byteLength,
      sha256,
      replaces: input.replacesId ?? null,
    },
  });

  return document;
}

export interface ReviewInput {
  documentId: string;
  agentId: string;
  decision: "VALIDATED" | "REJECTED";
  rejectionCode?: RejectionCode;
  note?: string;
}

export async function reviewDocument(input: ReviewInput) {
  if (input.decision === "REJECTED" && !input.rejectionCode) {
    throw new Error("A rejection must carry a reason the borrower can act on");
  }

  const document = await db.document.update({
    where: { id: input.documentId },
    data: {
      status: input.decision,
      rejectionCode: input.decision === "REJECTED" ? input.rejectionCode : null,
      reviewNote: input.note ?? null,
      reviewedBy: input.agentId,
      reviewedAt: new Date(),
    },
  });

  await recordAudit({
    applicationId: document.applicationId,
    action: "document_reviewed",
    actorType: "AGENT",
    actorId: input.agentId,
    payload: {
      documentId: document.id,
      kind: document.kind,
      decision: input.decision,
      rejectionCode: document.rejectionCode,
    },
  });

  return document;
}

/**
 * Documents an application still needs.
 *
 * A verified account check replaces the payslips: asking for both would be
 * collecting more than the step requires.
 */
/**
 * What this application must produce.
 *
 * Identity, an address the borrower actually lives at, proof that the payout
 * account is theirs, and evidence of the income they declared. The income
 * document depends on how they earn: a payslip proves nothing for someone
 * self-employed, and a tax assessment is not something an employee has to
 * hand.
 */
export async function requiredDocuments(applicationId: string): Promise<DocumentKind[]> {
  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { applicants: true },
  });

  const required: DocumentKind[] = ["ID_FRONT", "ID_BACK", "PROOF_OF_ADDRESS", "BANK_STATEMENT"];
  const primary = application.applicants.find((row) => row.role === "PRIMARY");

  required.push(primary?.employmentType === "SELF_EMPLOYED" ? "TAX_ASSESSMENT" : "PAYSLIP");

  return required;
}

export async function documentsFor(applicationId: string) {
  return db.document.findMany({
    where: { applicationId },
    orderBy: { uploadedAt: "asc" },
  });
}

/** True once every required kind has a validated, unreplaced file. */
export async function documentsComplete(applicationId: string): Promise<boolean> {
  const [required, documents] = await Promise.all([
    requiredDocuments(applicationId),
    documentsFor(applicationId),
  ]);
  return required.every((kind) =>
    documents.some(
      (document) =>
        document.kind === kind && document.status === "VALIDATED" && document.replacedById === null,
    ),
  );
}
