import { UnknownFactError, evaluateCondition, factsUsedBy, type Facts } from "./conditions";
import type { Decision, FiredRule, RuleSet, ScoreBand } from "./types";

const MAX_PRINCIPAL_REASONS = 4;

export class RuleSetValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid rule set: ${issues.join("; ")}`);
    this.name = "RuleSetValidationError";
  }
}

/**
 * Structural checks a rule set must pass before it can be published. Risk teams
 * edit these sets, so a broken threshold has to surface at publication time
 * rather than on a live applicant.
 */
export function validateRuleSet(ruleSet: RuleSet, knownFacts: readonly string[]): void {
  const issues: string[] = [];
  const known = new Set(knownFacts);
  const seenKeys = new Set<string>();

  if (ruleSet.bands.length === 0) issues.push("at least one score band is required");
  if (ruleSet.minScoreToAccept < ruleSet.minScoreToRefer) {
    issues.push("minScoreToAccept must be greater than or equal to minScoreToRefer");
  }

  const sortedBands = [...ruleSet.bands].sort((a, b) => a.minScore - b.minScore);
  sortedBands.forEach((band, index) => {
    if (index > 0 && band.minScore === sortedBands[index - 1].minScore) {
      issues.push(`duplicate band threshold ${band.minScore}`);
    }
    if (band.maxAmountFactor <= 0 || band.maxAmountFactor > 1) {
      issues.push(`band ${band.grade} has an out-of-range maxAmountFactor`);
    }
  });

  for (const rule of ruleSet.rules) {
    if (seenKeys.has(rule.key)) issues.push(`duplicate rule key "${rule.key}"`);
    seenKeys.add(rule.key);

    if (rule.effect === "SCORE" && (rule.points === undefined || rule.points === 0)) {
      issues.push(`scoring rule "${rule.key}" carries no points`);
    }
    if (!rule.reasonCode) issues.push(`rule "${rule.key}" has no reason code`);

    for (const fact of factsUsedBy(rule.when)) {
      if (!known.has(fact)) issues.push(`rule "${rule.key}" reads unknown fact "${fact}"`);
    }
  }

  if (issues.length > 0) throw new RuleSetValidationError(issues);
}

function bandForScore(bands: readonly ScoreBand[], score: number): ScoreBand | null {
  return (
    [...bands]
      .sort((a, b) => b.minScore - a.minScore)
      .find((band) => score >= band.minScore) ?? null
  );
}

/**
 * Evaluates every rule in the set — including after a decline has been
 * triggered — so the decision record carries the complete picture rather than
 * whichever rule happened to fire first.
 *
 * A rule referencing a fact that was not supplied is a configuration error, not
 * a silent pass: it fails the whole evaluation to REFER so a human looks at it.
 */
export function evaluate(ruleSet: RuleSet, facts: Facts, now = new Date()): Decision {
  const fired: FiredRule[] = [];
  let score = ruleSet.baseScore;
  let hasDecline = false;
  let hasRefer = false;
  let configurationBroken = false;

  for (const rule of ruleSet.rules) {
    if (rule.enabled === false) continue;

    let matches: boolean;
    try {
      matches = evaluateCondition(rule.when, facts);
    } catch (error) {
      if (error instanceof UnknownFactError) {
        configurationBroken = true;
        fired.push({
          key: rule.key,
          effect: "REFER",
          reasonCode: "reason.rule_not_evaluable",
          points: 0,
        });
        continue;
      }
      throw error;
    }
    if (!matches) continue;

    const points = rule.effect === "SCORE" ? (rule.points ?? 0) : 0;
    score += points;
    if (rule.effect === "DECLINE") hasDecline = true;
    if (rule.effect === "REFER") hasRefer = true;

    fired.push({ key: rule.key, effect: rule.effect, reasonCode: rule.reasonCode, points });
  }

  const outcome = hasDecline
    ? "DECLINE"
    : score < ruleSet.minScoreToRefer
      ? "DECLINE"
      : configurationBroken || hasRefer || score < ruleSet.minScoreToAccept
        ? "REFER"
        : "ACCEPT";

  // The explanation ranks by the size of the effect on the outcome: blocking
  // rules first, then the heaviest score movers in the decision's direction.
  const directional = outcome === "DECLINE" ? 1 : -1;
  const principalReasonCodes = [
    ...fired.filter((rule) => rule.effect !== "SCORE").map((rule) => rule.reasonCode),
    ...fired
      .filter((rule) => rule.effect === "SCORE" && rule.points * directional < 0)
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      .map((rule) => rule.reasonCode),
  ]
    .filter((code, index, all) => all.indexOf(code) === index)
    .slice(0, MAX_PRINCIPAL_REASONS);

  return {
    outcome,
    score,
    band: outcome === "DECLINE" ? null : bandForScore(ruleSet.bands, score),
    ruleSetKey: ruleSet.key,
    ruleSetVersion: ruleSet.version,
    firedRules: fired,
    principalReasonCodes,
    facts,
    evaluatedAt: now.toISOString(),
  };
}
