import { randomUUID } from "node:crypto";
import type { Minor } from "../../domain/finance/money";
import { createRng, pickOne, seedFrom } from "../deterministic";
import { shouldFail } from "./faults";
import type {
  CardPayment,
  ChargeOutcome,
  CollectionStatus,
  PaymentPort,
  ProviderCallMeta,
} from "../ports";

/** SEPA return codes a direct debit can come back with. */
const RETURN_CODES = ["AM04", "MS03", "AC04", "MD01"] as const;

/** Why a one-off charge was refused. */
const DECLINE_CODES = ["insufficient_funds", "card_expired", "do_not_honour"] as const;

/** The issuer identification ranges a European borrower is likely to hold. */
function brandOf(digits: string): string {
  if (/^4/.test(digits)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  return "CARD";
}

/**
 * Stand-in for a payment institution handling disbursement and SEPA direct
 * debit collection.
 *
 * Collections are keyed by loan and instalment index, so the same instalment
 * can never be collected twice however many times the scheduler retries — the
 * property that matters most in a payment adapter.
 */
export class SimulatedPaymentProvider implements PaymentPort {
  readonly name = "simulated-payments";
  private readonly collections = new Map<
    string,
    { reference: string; status: CollectionStatus; returnCode: string | null }
  >();
  private readonly charges = new Map<string, ChargeOutcome>();

  /**
   * Keyed by the caller's reference, not by a fresh id: that is what makes a
   * resubmitted fee payment settle on the first outcome instead of charging
   * the borrower a second time.
   */
  async charge(
    input: {
      applicationId: string;
      amount: Minor;
      currency: string;
      reference: string;
      card: CardPayment;
    },
    _meta: ProviderCallMeta,
  ): Promise<ChargeOutcome> {
    const existing = this.charges.get(input.reference);
    if (existing) return existing;

    const digits = input.card.number.replace(/\D/g, "");
    const rng = createRng(seedFrom("charge", input.reference));
    const declined = shouldFail(0.08, "charge-decline", input.reference);
    const outcome: ChargeOutcome = {
      providerReference: `chg_${randomUUID()}`,
      status: (declined ? "FAILED" : "SETTLED") as CollectionStatus,
      declineCode: declined ? pickOne(rng, DECLINE_CODES) : null,
      // The brand and the last four are the only things a payment institution
      // hands back about a card, and the only things worth keeping: they are
      // what a borrower recognises on a receipt without identifying the card.
      brand: brandOf(digits),
      last4: digits.slice(-4),
    };
    this.charges.set(input.reference, outcome);
    return outcome;
  }

  async disburse(
    _input: { applicationId: string; amount: Minor; currency: string; maskedIban: string },
    _meta: ProviderCallMeta,
  ): Promise<{ reference: string; valueDate: string }> {
    const valueDate = new Date();
    valueDate.setUTCDate(valueDate.getUTCDate() + 1);
    return {
      reference: `pay_${randomUUID()}`,
      valueDate: valueDate.toISOString().slice(0, 10),
    };
  }

  async collect(
    input: { loanId: string; instalmentIndex: number; amount: Minor; currency: string },
    _meta: ProviderCallMeta,
  ): Promise<{ reference: string; status: CollectionStatus; returnCode: string | null }> {
    const key = `${input.loanId}:${input.instalmentIndex}`;
    const existing = this.collections.get(key);
    if (existing) return existing;

    const rng = createRng(seedFrom("collect", input.loanId, input.instalmentIndex));
    const returned = shouldFail(0.05, "collect-return", input.loanId, input.instalmentIndex);
    const outcome = {
      reference: `col_${randomUUID()}`,
      status: (returned ? "RETURNED" : "SETTLED") as CollectionStatus,
      returnCode: returned ? pickOne(rng, RETURN_CODES) : null,
    };
    this.collections.set(key, outcome);
    return outcome;
  }
}
