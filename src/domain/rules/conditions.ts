/**
 * A deliberately small, closed predicate language.
 *
 * Risk teams edit rule sets as data, so conditions must never be executable
 * code: there is no expression string and no `eval` anywhere in this module.
 * Anything a rule can express is one of the nodes below, and an unknown node or
 * an unknown fact fails closed instead of silently evaluating to false.
 */

export type FactValue = number | string | boolean | null;
export type Facts = Readonly<Record<string, FactValue>>;

export type Condition =
  | { op: "always" }
  | { op: "and"; of: Condition[] }
  | { op: "or"; of: Condition[] }
  | { op: "not"; of: Condition }
  | { op: "lt" | "lte" | "gt" | "gte"; fact: string; value: number }
  | { op: "eq" | "neq"; fact: string; value: FactValue }
  | { op: "in" | "nin"; fact: string; values: Array<string | number | boolean> }
  | { op: "between"; fact: string; min: number; max: number }
  | { op: "isNull" | "notNull"; fact: string };

export class UnknownFactError extends Error {
  constructor(public readonly fact: string) {
    super(`Rule referenced unknown fact "${fact}"`);
    this.name = "UnknownFactError";
  }
}

function readFact(facts: Facts, name: string): FactValue {
  if (!(name in facts)) throw new UnknownFactError(name);
  return facts[name];
}

function asNumber(value: FactValue, fact: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null) return null;
  throw new TypeError(`Fact "${fact}" is not numeric`);
}

export function evaluateCondition(condition: Condition, facts: Facts): boolean {
  switch (condition.op) {
    case "always":
      return true;
    case "and":
      return condition.of.every((child) => evaluateCondition(child, facts));
    case "or":
      return condition.of.some((child) => evaluateCondition(child, facts));
    case "not":
      return !evaluateCondition(condition.of, facts);
    case "isNull":
      return readFact(facts, condition.fact) === null;
    case "notNull":
      return readFact(facts, condition.fact) !== null;
    case "eq":
      return readFact(facts, condition.fact) === condition.value;
    case "neq":
      return readFact(facts, condition.fact) !== condition.value;
    case "in":
      return condition.values.includes(readFact(facts, condition.fact) as never);
    case "nin":
      return !condition.values.includes(readFact(facts, condition.fact) as never);
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const value = asNumber(readFact(facts, condition.fact), condition.fact);
      // A missing measurement never satisfies a threshold: an applicant whose
      // income is unknown must not pass an "income above X" test.
      if (value === null) return false;
      if (condition.op === "lt") return value < condition.value;
      if (condition.op === "lte") return value <= condition.value;
      if (condition.op === "gt") return value > condition.value;
      return value >= condition.value;
    }
    case "between": {
      const value = asNumber(readFact(facts, condition.fact), condition.fact);
      if (value === null) return false;
      return value >= condition.min && value <= condition.max;
    }
    default: {
      const exhaustive: never = condition;
      throw new TypeError(`Unsupported condition ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Every fact name a condition depends on — used to validate a rule set. */
export function factsUsedBy(condition: Condition, into = new Set<string>()): Set<string> {
  switch (condition.op) {
    case "always":
      break;
    case "and":
    case "or":
      condition.of.forEach((child) => factsUsedBy(child, into));
      break;
    case "not":
      factsUsedBy(condition.of, into);
      break;
    default:
      into.add(condition.fact);
  }
  return into;
}
