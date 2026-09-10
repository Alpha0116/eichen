import { chance, createRng, seedFrom } from "../deterministic";

/**
 * Failure injection for the simulated providers.
 *
 * Real integrations fail, and a funnel that has only ever been exercised
 * against a cooperative provider will break the first time one is down. So the
 * simulators inject failures by default.
 *
 * That makes end-to-end runs non-deterministic, because the seed derives from
 * ids generated per run. The mode is therefore switchable:
 *
 *   on     (default) failures occur at their configured rate
 *   off              providers always succeed — for the happy-path journey test
 *   always           every failable call fails — for the fallback tests
 *
 * Set EICHEN_SIMULATED_FAULTS, or call setFaultMode from a test.
 */
export type FaultMode = "on" | "off" | "always";

let override: FaultMode | null = null;

export function setFaultMode(mode: FaultMode | null): void {
  override = mode;
}

export function faultMode(): FaultMode {
  if (override) return override;
  const fromEnv = process.env.EICHEN_SIMULATED_FAULTS;
  return fromEnv === "off" || fromEnv === "always" ? fromEnv : "on";
}

/**
 * Whether this particular call should fail.
 *
 * `seedParts` keeps a decision stable for a given call within a run, so a
 * retried request behaves consistently rather than flipping on each attempt —
 * except where the caller deliberately includes the attempt number, which is
 * how a transient outage that clears on retry is modelled.
 */
export function shouldFail(probability: number, ...seedParts: (string | number)[]): boolean {
  const mode = faultMode();
  if (mode === "off") return false;
  if (mode === "always") return true;
  return chance(createRng(seedFrom(...seedParts)), probability);
}
