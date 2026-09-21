import { NextResponse } from "next/server";
import { requireApplicationAccess } from "@/server/access";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { StoredFileNotFoundError, readStoredBytes, readStoredText } from "@/server/storage";

const KINDS = {
  contract: "storageKey",
  esis: "preContractualStorageKey",
  signature: "signatureStorageKey",
} as const;

/**
 * What each kind is called when it lands in the borrower's downloads folder.
 * A file named after its content beats one named after a storage key.
 */
const FILENAMES: Record<string, string> = {
  contract: "contrat",
  esis: "informations-precontractuelles",
  signature: "signature",
};

/**
 * Content type from the stored key rather than the kind.
 *
 * Documents are PDFs now. Contracts generated before that change are still on
 * disk as HTML and still have to open, so the extension decides — an old file
 * served as a PDF would download as something no reader can open.
 */
function contentTypeOf(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".png")) return "image/png";
  return "text/html; charset=utf-8";
}

/**
 * Serves the contract and the pre-contractual information sheet.
 *
 * Access is checked on every request rather than relying on the storage key
 * being unguessable, and the read is written to the audit trail: who looked at
 * a signed credit agreement, and when, is exactly the kind of access an audit
 * is supposed to be able to answer for.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string; kind: string }> },
) {
  const { applicationId, kind } = await context.params;
  if (!(kind in KINDS)) return new NextResponse("Not found", { status: 404 });

  const access = await requireApplicationAccess(applicationId);

  const contract = await db.contract.findFirst({
    where: { applicationId },
    orderBy: { version: "desc" },
  });
  // Once signed, the contract on offer is the signed copy: the same deed with
  // the signature page on the end. The unsigned original stays addressable in
  // storage, but nobody is served a copy of an agreement that looks unsigned.
  const storageKey =
    kind === "contract"
      ? (contract?.signedStorageKey ?? contract?.storageKey)
      : contract?.[KINDS[kind as keyof typeof KINDS]];
  if (!contract || !storageKey) return new NextResponse("Not found", { status: 404 });

  const contentType = contentTypeOf(storageKey);
  const html = contentType.startsWith("text/html");
  let body: string | Buffer;
  try {
    body = html ? await readStoredText(storageKey) : await readStoredBytes(storageKey);
  } catch (error) {
    // Only a missing file is a 404. A storage outage is a server fault and is
    // left to surface as one, rather than telling the borrower their contract
    // does not exist.
    if (error instanceof StoredFileNotFoundError) {
      return new NextResponse("Not found", { status: 404 });
    }
    throw error;
  }

  await recordAudit({
    applicationId,
    action: "sensitive_data_viewed",
    actorType: access.asStaff ? "AGENT" : "CUSTOMER",
    actorId: access.user?.id ?? null,
    payload: { document: kind, contractId: contract.id, version: contract.version },
  });

  // A Buffer is a Uint8Array view, which is a valid body; the union of it and
  // a string is not, so the two cases are narrowed here rather than cast.
  return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
      // Shown in the browser rather than pushed to disk — the borrower reads
      // the contract far more often than they file it — but under a name that
      // makes sense if they do save it.
      "content-disposition": `inline; filename="${FILENAMES[kind]}-${contract.version}.${
        storageKey.split(".").pop() ?? "pdf"
      }"`,
      // Nothing in these documents loads anything: a PDF and a PNG have no
      // subresources, and the legacy HTML carries its styles inline.
      "content-security-policy": html
        ? "default-src 'none'; style-src 'unsafe-inline'"
        : "default-src 'none'",
    },
  });
}
