import { NextResponse } from "next/server";
import { requireApplicationAccess } from "@/server/access";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { StoredFileNotFoundError, readStoredBytes } from "@/server/storage";

/**
 * Serves an uploaded document back to whoever may see it.
 *
 * The bytes never sit behind a guessable URL: the id names a row, and access
 * is decided on the application that row belongs to — staff, or the borrower
 * whose file it is. Every read is written to the audit trail, because looking
 * at someone's identity papers is an act, not a page view.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  // `?download=1` is what the back office's second link adds: the same bytes,
  // pushed to disk instead of opened, for an agent who needs the file itself
  // rather than a look at it.
  const download = new URL(request.url).searchParams.get("download") === "1";

  const document = await db.document.findUnique({
    where: { id: documentId },
    select: {
      applicationId: true,
      filename: true,
      mimeType: true,
      kind: true,
      storageKey: true,
    },
  });
  if (!document) return new NextResponse("Not found", { status: 404 });

  const access = await requireApplicationAccess(document.applicationId);

  let bytes: Buffer;
  try {
    bytes = await readStoredBytes(document.storageKey);
  } catch (error) {
    if (error instanceof StoredFileNotFoundError) return new NextResponse("Not found", { status: 404 });
    throw error;
  }

  await recordAudit({
    applicationId: document.applicationId,
    action: "sensitive_data_viewed",
    actorType: access.asStaff ? "AGENT" : "CUSTOMER",
    actorId: access.user?.id ?? null,
    payload: { documentId, kind: document.kind, download },
  });

  // `inline` so a PDF or an image opens in the browser; the filename is still
  // carried for a save. Quotes are stripped rather than escaped — a header is
  // not the place to be clever about a name the borrower chose.
  const filename = document.filename.replace(/["\\\r\n]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
