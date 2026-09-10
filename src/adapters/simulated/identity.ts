import { randomUUID } from "node:crypto";
import { createRng, pickOne, seedFrom } from "../deterministic";
import { shouldFail } from "./faults";
import type { IdentityMethod, IdentityPort, IdentitySession, ProviderCallMeta } from "../ports";

interface StoredSession {
  applicationId: string;
  method: IdentityMethod;
  createdAt: number;
  expiresAt: number;
}

const FAILURE_CODES = [
  "identity.failure.camera_unavailable",
  "identity.failure.document_unreadable",
  "identity.failure.agent_unavailable",
  "identity.failure.timeout",
] as const;

/**
 * Stand-in for an identity provider offering VideoIdent, a document journey and
 * an offline PostIdent-style fallback.
 *
 * The point of modelling three methods is that any one of them can be
 * unavailable to a given borrower — no camera, no smartphone, an outage at the
 * provider — and the application must still be completable. `failureCode` is
 * what the UI turns into the concrete next step.
 */
export class SimulatedIdentityProvider implements IdentityPort {
  readonly name = "simulated-identity";
  private readonly sessions = new Map<string, StoredSession>();

  async start(
    input: { applicationId: string; method: IdentityMethod; locale: string },
    _meta: ProviderCallMeta,
  ): Promise<IdentitySession> {
    const sessionId = `idv_${randomUUID()}`;
    const now = Date.now();
    // PostIdent is completed at a counter, so it stays open far longer.
    const ttlMinutes = input.method === "POST_IDENT" ? 60 * 24 * 7 : 30;
    const expiresAt = now + ttlMinutes * 60 * 1000;
    this.sessions.set(sessionId, {
      applicationId: input.applicationId,
      method: input.method,
      createdAt: now,
      expiresAt,
    });

    return {
      sessionId,
      method: input.method,
      status: "PENDING",
      redirectUrl:
        input.method === "POST_IDENT"
          ? null
          : `/simulator/identity/${sessionId}?locale=${encodeURIComponent(input.locale)}`,
      expiresAt: new Date(expiresAt).toISOString(),
      failureCode: null,
    };
  }

  async poll(input: { sessionId: string }, _meta: ProviderCallMeta): Promise<IdentitySession> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      return {
        sessionId: input.sessionId,
        method: "DOCUMENT_UPLOAD",
        status: "EXPIRED",
        redirectUrl: null,
        expiresAt: new Date().toISOString(),
        failureCode: "identity.failure.session_unknown",
      };
    }

    const base: IdentitySession = {
      sessionId: input.sessionId,
      method: session.method,
      status: "IN_PROGRESS",
      redirectUrl: null,
      expiresAt: new Date(session.expiresAt).toISOString(),
      failureCode: null,
    };

    if (Date.now() > session.expiresAt) {
      return { ...base, status: "EXPIRED", failureCode: "identity.failure.timeout" };
    }

    const rng = createRng(seedFrom("identity", session.applicationId, session.method));
    if (shouldFail(0.12, "identity-fail", session.applicationId, session.method)) {
      return { ...base, status: "FAILED", failureCode: pickOne(rng, FAILURE_CODES) };
    }
    return { ...base, status: "VERIFIED" };
  }
}
