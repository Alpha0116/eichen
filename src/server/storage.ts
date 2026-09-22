import { BlobNotFoundError, del as delBlob, get as getBlob, put as putBlob } from "@vercel/blob";
import { db } from "./db";

/**
 * Where uploaded documents and generated contracts live.
 *
 * Two backends behind one pair of functions, chosen once from the environment:
 *
 * - With `BLOB_READ_WRITE_TOKEN` set, files go to Vercel Blob as private
 *   blobs, only ever read back through this module and never by URL.
 * - Otherwise, the `StoredFile` table of the database the site already has.
 *   That is the default because it needs nothing configured: a deploy with a
 *   database is a deploy that can take documents. A serverless function has no
 *   writable, persistent disk, so a file written beside the code was never an
 *   option in production, and the table is what makes a fresh deploy work
 *   without anyone touching the hosting account.
 *
 * Either way a stored key is a plain relative path, `<applicationId>/<name>`,
 * and the rows in the database hold only that key — switching backend does
 * not touch them. A key is written once and never replaced.
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export class StoredFileNotFoundError extends Error {
  constructor(key: string) {
    super(`No stored file under ${key}`);
    this.name = "StoredFileNotFoundError";
  }
}

export async function writeStored(key: string, bytes: Buffer): Promise<void> {
  if (BLOB_TOKEN) {
    await putBlob(key, bytes, { access: "private", addRandomSuffix: false, token: BLOB_TOKEN });
    return;
  }
  // Prisma's Bytes wants a Uint8Array over a plain ArrayBuffer; a Buffer may
  // sit on a shared one, so the bytes are copied into one that is not.
  const bytesCopy = new Uint8Array(bytes.byteLength);
  bytesCopy.set(bytes);
  await db.storedFile.create({ data: { key, bytes: bytesCopy, sizeBytes: bytes.byteLength } });
}

/**
 * Removes a stored file, if it is still there.
 *
 * A key that no longer exists is not an error: this is called when the row
 * that named it is already gone, and a delete that fails because the work is
 * already done would leave the caller nothing sensible to do.
 */
export async function deleteStored(key: string): Promise<void> {
  if (BLOB_TOKEN) {
    try {
      await delBlob(key, { token: BLOB_TOKEN });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
    }
    return;
  }
  await db.storedFile.deleteMany({ where: { key } });
}

export async function readStoredBytes(key: string): Promise<Buffer> {
  if (BLOB_TOKEN) {
    let result;
    try {
      result = await getBlob(key, { access: "private", token: BLOB_TOKEN });
    } catch (error) {
      if (error instanceof BlobNotFoundError) throw new StoredFileNotFoundError(key);
      throw error;
    }
    if (!result || result.stream === null) throw new StoredFileNotFoundError(key);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  const row = await db.storedFile.findUnique({ where: { key }, select: { bytes: true } });
  if (!row) throw new StoredFileNotFoundError(key);
  return Buffer.from(row.bytes);
}

export async function readStoredText(key: string): Promise<string> {
  return (await readStoredBytes(key)).toString("utf8");
}
