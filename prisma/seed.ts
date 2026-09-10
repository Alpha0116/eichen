import { LENDER_CATALOGUE } from "../src/domain/offers/catalogue";
import { DEFAULT_RULE_SET_DE } from "../src/domain/rules/defaultRuleSet";
import { db } from "../src/server/db";
import { toJson } from "../src/server/json";
import { publishRuleSet } from "../src/server/services/rules";

/**
 * Seeds the reference configuration: the lender catalogue and the rule set.
 *
 * It creates no accounts. A seed that invents administrators with a password
 * printed in its own output is a back door that reappears every time somebody
 * runs it — accounts are created deliberately, by `scripts/reset-accounts.ts`.
 *
 * Idempotent: running it twice does not create a second copy of anything, and
 * it never republishes a rule set that is already live — publishing is what
 * creates a new version, and versions are not something a seed should inflate.
 */
async function main() {
  for (const product of LENDER_CATALOGUE) {
    await db.lenderProductRecord.upsert({
      where: { id: product.id },
      update: {
        lenderName: product.lenderName,
        country: product.country,
        payloadJson: toJson(product),
        active: true,
      },
      create: {
        id: product.id,
        lenderName: product.lenderName,
        country: product.country,
        payloadJson: toJson(product),
      },
    });
  }

  // Publishing is versioned: if the reference set in the codebase has changed,
  // this creates the next version rather than mutating the live one, so every
  // past decision can still be replayed against the set that produced it.
  const published = await db.ruleSetRecord.findFirst({
    where: { key: DEFAULT_RULE_SET_DE.key, status: "PUBLISHED" },
  });
  const comparable = (value: unknown) =>
    toJson({ ...(value as Record<string, unknown>), version: 0, publishedAt: "" });
  const unchanged =
    published !== null &&
    comparable(JSON.parse(published.payloadJson)) === comparable(DEFAULT_RULE_SET_DE);

  // Published without an author, because there is none: this is the reference
  // set that ships with the codebase, not a decision somebody took at a desk.
  // The audit entry records it as a SYSTEM act rather than crediting whichever
  // account happened to exist when the seed ran.
  if (!unchanged) {
    await publishRuleSet({
      ruleSet: DEFAULT_RULE_SET_DE,
      note: published
        ? "Reference rule set updated in the codebase."
        : "Initial reference rule set for the German market.",
      publishedBy: null,
    });
  }

  const counts = {
    users: await db.user.count(),
    lenders: await db.lenderProductRecord.count(),
    ruleSets: await db.ruleSetRecord.count(),
  };
  console.log("Seed complete:", counts);
  console.log("No accounts were created: use scripts/reset-accounts.ts for those.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
