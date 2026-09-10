import { createHash } from "node:crypto";

/**
 * Deterministic pseudo-randomness for the simulated integrations.
 *
 * Every simulated provider derives its answers from a seed built out of the
 * application's own data, so the same applicant always gets the same bureau
 * score and the same account-check outcome. Demos, screenshots and tests are
 * reproducible, and a retried call returns the same answer instead of quietly
 * changing the decision.
 */
export function seedFrom(...parts: (string | number | null | undefined)[]): number {
  const digest = createHash("sha256").update(parts.map(String).join("|"), "utf8").digest();
  return digest.readUInt32BE(0);
}

/** Mulberry32 — small, fast, and stable across Node versions. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** True with probability `p`, drawn from the same deterministic stream. */
export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}
