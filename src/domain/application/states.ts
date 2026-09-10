/**
 * Application lifecycle.
 *
 * The order mirrors the funnel the borrower actually walks:
 *
 *   1. DRAFT              simulation and personal details, still editable
 *   2. SUBMITTED          handed to an administrator, waiting on a decision
 *   3. APPROVED           an administrator validated the file
 *   4. CONTRACT_READY     the contract exists and is waiting for a signature
 *   5. SIGNED             the borrower signed it
 *   6. FEE_PENDING        the account fee is due
 *   7. FEE_PAID           the fee settled; the payout is being prepared
 *   8. DISBURSED → ACTIVE the loan exists and is being serviced
 *
 * There is no automated credit decision in this flow: every application stops
 * at SUBMITTED until a person moves it. The rule engine still runs, but it
 * produces a recommendation an administrator reads, never a state change.
 */
export const APPLICATION_STATES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "CONTRACT_READY",
  "SIGNED",
  "FEE_PENDING",
  "FEE_PAID",
  "DISBURSED",
  "ACTIVE",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
  "CLOSED",
  "DEFAULTED",
] as const;

export type ApplicationState = (typeof APPLICATION_STATES)[number];

export type Actor = "CUSTOMER" | "AGENT" | "SYSTEM";

/** States from which no further transition is possible. */
export const TERMINAL_STATES: ReadonlySet<ApplicationState> = new Set([
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
  "CLOSED",
]);

/**
 * States in which the borrower is still assembling the file and nothing has
 * been submitted to anyone. Editing amount, term or personal details is only
 * allowed here.
 */
export const EDITABLE_STATES: ReadonlySet<ApplicationState> = new Set(["DRAFT"]);

type TransitionTable = Readonly<Record<ApplicationState, readonly ApplicationState[]>>;

/**
 * Allowed transitions. Abandonment paths (WITHDRAWN, EXPIRED) are listed
 * explicitly per state rather than injected globally, so that a state which
 * must not be abandoned — a disbursed loan — genuinely cannot be.
 */
export const TRANSITIONS: TransitionTable = {
  DRAFT: ["SUBMITTED", "WITHDRAWN", "EXPIRED"],
  // An administrator can send the file back for correction instead of
  // refusing it outright, which is the difference between "your payslip is
  // unreadable" and "no".
  SUBMITTED: ["APPROVED", "DECLINED", "DRAFT", "WITHDRAWN", "EXPIRED"],
  APPROVED: ["CONTRACT_READY", "WITHDRAWN"],
  CONTRACT_READY: ["SIGNED", "WITHDRAWN"],
  // The statutory 14-day withdrawal right survives signature.
  SIGNED: ["FEE_PENDING", "WITHDRAWN"],
  FEE_PENDING: ["FEE_PAID", "WITHDRAWN"],
  FEE_PAID: ["DISBURSED", "WITHDRAWN"],
  DISBURSED: ["ACTIVE"],
  ACTIVE: ["CLOSED", "DEFAULTED"],
  DEFAULTED: ["CLOSED"],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  CLOSED: [],
};

/**
 * Who may drive each transition.
 *
 * APPROVED and DECLINED are deliberately not open to SYSTEM: the whole point
 * of this funnel is that a person validates every application, so there is no
 * code path that can approve one on its own.
 */
const ACTOR_RULES: Partial<Record<ApplicationState, readonly Actor[]>> = {
  SUBMITTED: ["CUSTOMER"],
  APPROVED: ["AGENT"],
  DECLINED: ["AGENT"],
  DRAFT: ["AGENT"],
  CONTRACT_READY: ["AGENT", "SYSTEM"],
  SIGNED: ["CUSTOMER"],
  FEE_PENDING: ["SYSTEM"],
  // An administrator confirms the fee has reached us, because it is settled
  // with support rather than on the site.
  FEE_PAID: ["CUSTOMER", "AGENT", "SYSTEM"],
  DISBURSED: ["AGENT", "SYSTEM"],
  ACTIVE: ["SYSTEM"],
  DEFAULTED: ["SYSTEM", "AGENT"],
  EXPIRED: ["SYSTEM"],
};

export type TransitionCheck =
  | { ok: true; noop: boolean }
  | { ok: false; reason: "TERMINAL" | "NOT_ALLOWED" | "ACTOR_FORBIDDEN" };

/**
 * Pure guard for a state change. Re-entering the current state is reported as a
 * successful no-op so that a retried webhook or a double-submitted form settles
 * on the same state instead of raising.
 */
export function checkTransition(
  from: ApplicationState,
  to: ApplicationState,
  actor: Actor,
): TransitionCheck {
  if (from === to) return { ok: true, noop: true };
  if (TERMINAL_STATES.has(from)) return { ok: false, reason: "TERMINAL" };
  if (!TRANSITIONS[from].includes(to)) return { ok: false, reason: "NOT_ALLOWED" };

  const allowedActors = ACTOR_RULES[to];
  if (allowedActors && !allowedActors.includes(actor)) {
    return { ok: false, reason: "ACTOR_FORBIDDEN" };
  }
  return { ok: true, noop: false };
}

export function isEditable(state: ApplicationState): boolean {
  return EDITABLE_STATES.has(state);
}

/**
 * Position in the five-step funnel the borrower sees, or 0 for a file that has
 * left the funnel (declined, withdrawn, expired).
 *
 * Derived from the state rather than from the URL: someone following a stale
 * link must land on the step their file is actually waiting on.
 */
export const FUNNEL_STEP_COUNT = 5;

export function funnelStep(state: ApplicationState): number {
  switch (state) {
    case "DRAFT":
      return 1;
    case "SUBMITTED":
      return 2;
    case "APPROVED":
    case "CONTRACT_READY":
      return 3;
    case "SIGNED":
    case "FEE_PENDING":
      return 4;
    case "FEE_PAID":
    case "DISBURSED":
    case "ACTIVE":
    case "CLOSED":
      return 5;
    default:
      return 0;
  }
}
