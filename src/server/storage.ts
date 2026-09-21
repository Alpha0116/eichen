import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Where uploaded documents and generated contracts live on disk.
 *
 * `DOCUMENT_STORAGE_DIR` names the directory; without it the app falls back to
 * `.storage/documents` under the working directory, which is fine on a laptop
 * and wrong in production — a serverless bundle has no writable, persistent
 * working directory, and the files would not survive the next deploy even if
 * it had. Resolved once to an absolute path so a stored key never depends on
 * where the process happened to be started from.
 */
export const DOCUMENT_STORAGE_ROOT = resolve(
  process.env.DOCUMENT_STORAGE_DIR ?? "./.storage/documents",
);

export class StorageNotWritableError extends Error {
  constructor(root: string, cause: unknown) {
    super(
      `Document storage at ${root} is not writable. ` +
        (process.env.DOCUMENT_STORAGE_DIR
          ? "Check that DOCUMENT_STORAGE_DIR exists and the process may write to it."
          : "DOCUMENT_STORAGE_DIR is not set, so the working directory was used; point it at a persistent, writable directory."),
      { cause },
    );
    this.name = "StorageNotWritableError";
  }
}

/**
 * Writes bytes under a storage key, creating the key's directory on the way.
 *
 * A failure to create the directory is a configuration fault, not a request
 * fault, and is reported as one: the raw ENOENT from a relative `mkdir` says
 * nothing about which variable to set.
 */
export async function writeStored(key: string, bytes: Buffer): Promise<void> {
  const absolute = join(DOCUMENT_STORAGE_ROOT, key);
  try {
    await mkdir(dirname(absolute), { recursive: true });
  } catch (error) {
    throw new StorageNotWritableError(DOCUMENT_STORAGE_ROOT, error);
  }
  await writeFile(absolute, bytes, { mode: 0o600 });
}

export async function readStoredBytes(key: string): Promise<Buffer> {
  return readFile(join(DOCUMENT_STORAGE_ROOT, key));
}

export async function readStoredText(key: string): Promise<string> {
  return readFile(join(DOCUMENT_STORAGE_ROOT, key), "utf8");
}
