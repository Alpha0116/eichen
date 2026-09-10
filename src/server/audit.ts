import {
  GENESIS_HASH,
  computeAuditHash,
  scrubPayload,
  verifyChain,
  type AuditAction,
  type AuditEntry,
} from "../domain/compliance/audit";
import { db } from "./db";
import { fromJson, toJson } from "./json";

export interface RecordAuditInput {
  applicationId: string | null;
  action: AuditAction;
  actorType: "CUSTOMER" | "AGENT" | "SYSTEM";
  actorId?: string | null;
  payload?: Record<string, unknown>;
}

const MAX_ATTEMPTS = 5;

/**
 * Appends an entry to an application's audit chain.
 *
 * Two writers appending at once would both read the same tail sequence, so the
 * unique index on (applicationId, sequence) is the arbiter: the loser retries
 * against the new tail rather than overwriting it. This is why the sequence is
 * not a plain autoincrement — the chain has to be contiguous per application
 * for `verifyApplicationChain` to mean anything.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const payload = scrubPayload(input.payload ?? {});

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const tail = await db.auditEntry.findFirst({
      where: { applicationId: input.applicationId },
      orderBy: { sequence: "desc" },
      select: { sequence: true, hash: true },
    });

    const sequence = (tail?.sequence ?? 0) + 1;
    const previousHash = tail?.hash ?? GENESIS_HASH;
    const occurredAt = new Date();

    const hash = computeAuditHash(
      {
        sequence,
        applicationId: input.applicationId,
        action: input.action,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        payload,
        occurredAt,
      },
      previousHash,
    );

    try {
      await db.auditEntry.create({
        data: {
          applicationId: input.applicationId,
          sequence,
          action: input.action,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          payloadJson: toJson(payload),
          occurredAt,
          previousHash,
          hash,
        },
      });
      return;
    } catch (error) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (!isUniqueViolation || attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
}

export interface TimelineEntry {
  sequence: number;
  action: string;
  actorType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  hash: string;
}

export async function timelineFor(applicationId: string): Promise<TimelineEntry[]> {
  const rows = await db.auditEntry.findMany({
    where: { applicationId },
    orderBy: { sequence: "asc" },
  });
  return rows.map((row) => ({
    sequence: row.sequence,
    action: row.action,
    actorType: row.actorType,
    actorId: row.actorId,
    payload: fromJson<Record<string, unknown>>(row.payloadJson, {}),
    occurredAt: row.occurredAt,
    hash: row.hash,
  }));
}

/** Recomputes the chain to detect any entry that was edited or removed. */
export async function verifyApplicationChain(applicationId: string) {
  const rows = await db.auditEntry.findMany({
    where: { applicationId },
    orderBy: { sequence: "asc" },
  });

  const entries: AuditEntry[] = rows.map((row) => ({
    sequence: row.sequence,
    applicationId: row.applicationId,
    action: row.action as AuditAction,
    actorType: row.actorType as AuditEntry["actorType"],
    actorId: row.actorId,
    payload: fromJson<Record<string, unknown>>(row.payloadJson, {}),
    occurredAt: row.occurredAt,
    previousHash: row.previousHash,
    hash: row.hash,
  }));

  return { ...verifyChain(entries), count: entries.length };
}
