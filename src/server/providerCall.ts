import { createHash } from "node:crypto";
import type { ProviderCallMeta } from "../adapters/ports";

/**
 * Idempotency key for a provider call.
 *
 * Built from the application and the logical operation rather than randomly, so
 * a retry after a timeout carries the same key as the call that may already
 * have succeeded — which is the only way the provider can deduplicate it.
 */
export function idempotencyKey(...parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 32);
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  onAttemptFailed?: (attempt: number, error: unknown) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a provider call with bounded exponential backoff.
 *
 * The same idempotency key is passed on every attempt; only `attempt` changes,
 * which lets an adapter distinguish a first call from a retry. Exhausting the
 * attempts rethrows: callers decide whether that means a fallback path or a
 * referral to a human, and none of them may treat it as a silent success.
 */
export async function withRetry<T>(
  key: string,
  call: (meta: ProviderCallMeta) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 150;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await call({ idempotencyKey: key, attempt });
    } catch (error) {
      lastError = error;
      options.onAttemptFailed?.(attempt, error);
      if (attempt < attempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
