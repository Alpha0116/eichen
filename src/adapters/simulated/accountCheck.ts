import { randomUUID } from "node:crypto";
import type { BankCheckResult } from "../../domain/application/types";
import { roundMinor } from "../../domain/finance/money";
import { chance, createRng, pickInt, seedFrom } from "../deterministic";
import { shouldFail } from "./faults";
import type {
  AccountCheckPort,
  AccountCheckPrefill,
  AccountCheckSession,
  ProviderCallMeta,
} from "../ports";

interface PendingSession {
  applicationId: string;
  bankName: string;
  observationMonths: number;
  expiresAt: number;
}

/**
 * Stand-in for a licensed account-information service (the Kontoblick /
 * digital Kontocheck step).
 *
 * Note what it does not do: it never receives, returns or stores bank
 * credentials. The borrower authenticates at their own bank behind
 * `authorisationUrl`, and what comes back here is a set of derived figures —
 * no statement lines, no counterparties, no account number.
 */
export class SimulatedAccountCheck implements AccountCheckPort {
  readonly name = "simulated-account-check";
  private readonly sessions = new Map<string, PendingSession>();

  async start(
    input: { applicationId: string; bankName: string; observationMonths: number },
    meta: ProviderCallMeta,
  ): Promise<AccountCheckSession> {
    const sessionId = `acs_${randomUUID()}`;
    const expiresAt = Date.now() + 20 * 60 * 1000;
    this.sessions.set(sessionId, { ...input, expiresAt });
    return {
      sessionId,
      authorisationUrl: `/simulator/account-check/${sessionId}?ref=${encodeURIComponent(meta.idempotencyKey)}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async complete(
    input: { sessionId: string; applicationId: string },
    _meta: ProviderCallMeta,
  ): Promise<{ result: BankCheckResult; prefill: AccountCheckPrefill }> {
    const session = this.sessions.get(input.sessionId);
    const observationMonths = session?.observationMonths ?? 3;

    if (session && session.expiresAt < Date.now()) {
      return {
        result: {
          status: "FAILED",
          verifiedNetMonthlyIncome: null,
          overdraftDays: null,
          returnedDirectDebits: null,
          detectedLoanInstalments: null,
          observationMonths: null,
          completedAt: new Date().toISOString(),
        },
        prefill: {
          verifiedNetMonthlyIncome: null,
          detectedHousingCost: null,
          detectedLoanInstalments: null,
          employerName: null,
        },
      };
    }

    const rng = createRng(seedFrom("account-check", input.applicationId));

    // Bank connections fail often enough in reality that the fallback path has
    // to be a first-class part of the funnel rather than an error page.
    if (shouldFail(0.08, "account-check-fail", input.applicationId)) {
      return {
        result: {
          status: "FAILED",
          verifiedNetMonthlyIncome: null,
          overdraftDays: null,
          returnedDirectDebits: null,
          detectedLoanInstalments: null,
          observationMonths: null,
          completedAt: new Date().toISOString(),
        },
        prefill: {
          verifiedNetMonthlyIncome: null,
          detectedHousingCost: null,
          detectedLoanInstalments: null,
          employerName: null,
        },
      };
    }

    const baseIncome = pickInt(rng, 180_000, 480_000);
    const verifiedNetMonthlyIncome = roundMinor(baseIncome / 100) * 100;
    const overdraftDays = chance(rng, 0.25) ? pickInt(rng, 5, 70) : pickInt(rng, 0, 4);
    const returnedDirectDebits = chance(rng, 0.15) ? pickInt(rng, 1, 4) : 0;
    const detectedLoanInstalments = chance(rng, 0.4) ? pickInt(rng, 5_000, 45_000) : 0;
    const detectedHousingCost = pickInt(rng, 45_000, 140_000);

    return {
      result: {
        status: "VERIFIED",
        verifiedNetMonthlyIncome,
        overdraftDays,
        returnedDirectDebits,
        detectedLoanInstalments,
        observationMonths,
        completedAt: new Date().toISOString(),
      },
      prefill: {
        verifiedNetMonthlyIncome,
        detectedHousingCost,
        detectedLoanInstalments,
        employerName: session ? `${session.bankName} Gehaltseingang` : null,
      },
    };
  }
}
