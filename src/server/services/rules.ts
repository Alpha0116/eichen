import { validateRuleSet } from "../../domain/rules/engine";
import { KNOWN_FACTS } from "../../domain/rules/facts";
import { DEFAULT_RULE_SET_DE } from "../../domain/rules/defaultRuleSet";
import type { RuleSet } from "../../domain/rules/types";
import { recordAudit } from "../audit";
import { db } from "../db";
import { fromJson, toJson } from "../json";

export class NoPublishedRuleSetError extends Error {
  constructor(country: string) {
    super(`No published rule set for ${country}`);
    this.name = "NoPublishedRuleSetError";
  }
}

/**
 * The rule set in force for a country, highest published version wins.
 *
 * Decisions store the key and version they used, so an older version stays
 * loadable forever — `ruleSetAt` is how a past decision is replayed.
 */
export async function publishedRuleSet(country: string): Promise<RuleSet> {
  const row = await db.ruleSetRecord.findFirst({
    where: { country, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!row) throw new NoPublishedRuleSetError(country);
  return fromJson<RuleSet>(row.payloadJson, DEFAULT_RULE_SET_DE);
}

export async function ruleSetAt(key: string, version: number): Promise<RuleSet | null> {
  const row = await db.ruleSetRecord.findUnique({ where: { key_version: { key, version } } });
  return row ? fromJson<RuleSet>(row.payloadJson, DEFAULT_RULE_SET_DE) : null;
}

export async function listRuleSets(country?: string) {
  return db.ruleSetRecord.findMany({
    where: country ? { country } : undefined,
    orderBy: [{ key: "asc" }, { version: "desc" }],
  });
}

export interface PublishInput {
  ruleSet: Omit<RuleSet, "version" | "publishedAt">;
  note?: string;
  /**
   * The administrator who published it, or null when nobody did — the seed
   * installing the reference set that ships with the codebase. Publishing from
   * the back office always names its author; only the seed does not.
   */
  publishedBy: string | null;
}

/**
 * Publishes a new version of a rule set.
 *
 * A published row is never mutated. Publishing archives the current version and
 * inserts the next one, which is what makes "this application was decided under
 * version 3" a statement that can still be checked next year.
 *
 * The set is validated against the known fact vocabulary first: a rule reading
 * a fact the engine does not produce would otherwise fail open on live traffic.
 */
export async function publishRuleSet(input: PublishInput) {
  validateRuleSet({ ...input.ruleSet, version: 0, publishedAt: "" }, KNOWN_FACTS);

  const latest = await db.ruleSetRecord.findFirst({
    where: { key: input.ruleSet.key },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const publishedAt = new Date();

  const payload: RuleSet = {
    ...input.ruleSet,
    version,
    publishedAt: publishedAt.toISOString(),
  };

  const record = await db.$transaction(async (tx) => {
    await tx.ruleSetRecord.updateMany({
      where: { key: input.ruleSet.key, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    return tx.ruleSetRecord.create({
      data: {
        key: payload.key,
        version,
        country: payload.country,
        status: "PUBLISHED",
        payloadJson: toJson(payload),
        note: input.note ?? null,
        publishedAt,
        publishedBy: input.publishedBy,
      },
    });
  });

  await recordAudit({
    applicationId: null,
    action: "application_updated",
    // An authorless publication is the seed's, and saying AGENT would put a
    // person in the trail where there was none.
    actorType: input.publishedBy ? "AGENT" : "SYSTEM",
    actorId: input.publishedBy,
    payload: { ruleSetKey: payload.key, version, note: input.note ?? null },
  });

  return record;
}
