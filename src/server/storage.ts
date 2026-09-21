import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { BlobNotFoundError, get as getBlob, put as putBlob } from "@vercel/blob";

/**
 * Where uploaded documents and generated contracts live.
 *
 * Two backends behind one pair of functions, chosen once from the environment:
 *
 * - With `BLOB_READ_WRITE_TOKEN` set, files go to Vercel Blob as private
 *   blobs. This is the production case: a serverless function has no
 *   writable, persistent disk, and a file written there is gone at the next
 *   invocation, let alone the next deploy. Private access means a blob is
 *   only ever read back through this module, never by URL.
 * - Otherwise, the local disk under `DOCUMENT_STORAGE_DIR` (default
 *   `.storage/documents` beside the checkout), which is what a laptop wants.
 *
 * Either way a stored key is a plain relative path, `<applicationId>/<name>`,
 * and the rows in the database hold only that key — switching backend does
 * not touch them.
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export const DOCUMENT_STORAGE_ROOT = resolve(
  process.env.DOCUMENT_STORAGE_DIR ?? "./.storage/documents",
);

export class StorageNotWritableError extends Error {
  constructor(root: string, cause: unknown) {
    super(
      `Document storage at ${root} is not writable. ` +
        (process.env.DOCUMENT_STORAGE_DIR
          ? "Check that DOCUMENT_STORAGE_DIR exists and the process may write to it."
          : "Neither BLOB_READ_WRITE_TOKEN nor DOCUMENT_STORAGE_DIR is set, so the working directory was used; connect a Vercel Blob store or point DOCUMENT_STORAGE_DIR at a persistent, writable directory."),
      { cause },
    );
    this.name = "StorageNotWritableError";
  }
}

export class StoredFileNotFoundError extends Error {
  constructor(key: string) {
    super(`No stored file under ${key}`);
    this.name = "StoredFileNotFoundError";
  }
}

/** Writes bytes under a storage key. A key is written once and never replaced. */
export async function writeStored(key: string, bytes: Buffer): Promise<void> {
  if (BLOB_TOKEN) {
    await putBlob(key, bytes, {
      access: "private",
      addRandomSuffix: false,
      token: BLOB_TOKEN,
    });
    return;
  }

  const absolute = join(DOCUMENT_STORAGE_ROOT, key);
  try {
    await mkdir(dirname(absolute), { recursive: true });
  } catch (error) {
    throw new StorageNotWritableError(DOCUMENT_STORAGE_ROOT, error);
  }
  await writeFile(absolute, bytes, { mode: 0o600 });
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

  try {
    return await readFile(join(DOCUMENT_STORAGE_ROOT, key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StoredFileNotFoundError(key);
    throw error;
  }
}

export async function readStoredText(key: string): Promise<string> {
  return (await readStoredBytes(key)).toString("utf8");
}
