import { createHash } from "node:crypto";

/**
 * Append-only audit trail with a per-application hash chain.
 *
 * Each entry commits to the hash of the previous one, so removing or editing a
 * past entry invalidates every hash after it. That does not make the log
 * impossible to tamper with — a writer with database access could recompute the
 * chain — but it makes silent tampering detectable by `verifyChain`, which is
 * what an audit actually needs.
 */

export const AUDIT_ACTIONS = [
  "simulation_created",
  "application_created",
  "application_updated",
  "application_returned",
  "consent_granted",
  "consent_revoked",
  "document_uploaded",
  "document_reviewed",
  "application_submitted",
  "contract_generated",
  "contract_signed",
  "account_fee_issued",
  "account_fee_paid",
  "account_fee_declined",
  "decision_overridden",
  "credit_decision_final",
  "disbursed",
  "payment_recorded",
  "settlement_quoted",
  "loan_closed",
  "sensitive_data_viewed",
  "data_export_requested",
  "state_changed",
  "admin_account_created",
  "application_deleted",
  "transfer_requested",
  "account_space_updated",
  "transfer_attempts_reset",
  "company_bank_updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntryInput {
  applicationId: string | null;
  action: AuditAction;
  actorType: "CUSTOMER" | "AGENT" | "SYSTEM";
  actorId: string | null;
  /**
   * Structured context. Must never contain a document body, an IBAN, a
   * password or a raw bureau payload — only identifiers and outcomes.
   */
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface AuditEntry extends AuditEntryInput {
  sequence: number;
  previousHash: string;
  hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

/**
 * Canonical JSON: object keys sorted at every depth so that two structurally
 * identical payloads always hash the same, whatever order they were built in.
 */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalise(item)}`);
  return `{${entries.join(",")}}`;
}

export function computeAuditHash(
  entry: AuditEntryInput & { sequence: number },
  previousHash: string,
): string {
  const material = canonicalise({
    sequence: entry.sequence,
    applicationId: entry.applicationId,
    action: entry.action,
    actorType: entry.actorType,
    actorId: entry.actorId,
    payload: entry.payload,
    occurredAt: entry.occurredAt.toISOString(),
    previousHash,
  });
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function sealEntry(
  input: AuditEntryInput,
  sequence: number,
  previousHash: string,
): AuditEntry {
  const withSequence = { ...input, sequence };
  return {
    ...withSequence,
    previousHash,
    hash: computeAuditHash(withSequence, previousHash),
  };
}

export interface ChainVerification {
  valid: boolean;
  /** Sequence number of the first entry that does not verify. */
  brokenAt: number | null;
}

export function verifyChain(entries: readonly AuditEntry[]): ChainVerification {
  let previousHash = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.previousHash !== previousHash) return { valid: false, brokenAt: entry.sequence };
    if (computeAuditHash(entry, previousHash) !== entry.hash) {
      return { valid: false, brokenAt: entry.sequence };
    }
    previousHash = entry.hash;
  }
  return { valid: true, brokenAt: null };
}

/** Keys that must never reach the audit payload. */
const FORBIDDEN_KEYS = new Set([
  "iban",
  "bic",
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "documentBody",
  "fileContent",
  "birthDate",
  "taxId",
]);

/**
 * Strips anything that must not be persisted in the trail. Called on the way
 * in rather than trusted at the call site, because one careless spread is
 * enough to put an IBAN in a log that is kept for a decade.
 */
export function scrubPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      clean[key] = "[redacted]";
      continue;
    }
    clean[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? scrubPayload(value as Record<string, unknown>)
        : value;
  }
  return clean;
}
