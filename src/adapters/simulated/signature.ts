import { createHash, randomUUID } from "node:crypto";
import type { ProviderCallMeta, SignatureEnvelope, SignaturePort } from "../ports";

interface StoredEnvelope {
  applicationId: string;
  documentHash: string;
  signerName: string;
  expiresAt: number;
  signedAt: string | null;
  evidenceHash: string | null;
  signatureHash: string | null;
}

/** A stroke smaller than this is a stray tap, not a signature. */
const MIN_SIGNATURE_BYTES = 512;

/** How long a prepared contract stays signable before it must be reopened. */
const ENVELOPE_TTL_MS = 60 * 60 * 1000;

/**
 * Stand-in for an electronic signature provider taking a handwritten stroke —
 * the pattern used where the borrower signs on screen with a mouse, a finger
 * or a stylus.
 *
 * The envelope binds the signature to the exact bytes that were displayed:
 * `documentHash` is fixed at creation, and the evidence hash commits to the
 * document, the signer, the moment of signing and the drawing itself. A
 * contract regenerated afterwards would not match, and neither would the same
 * document signed with a different stroke.
 *
 * This is a simple electronic signature (eIDAS Art. 3(10)), not a qualified
 * one: it proves what was drawn against what was shown, not who held the
 * mouse. Swapping in a QES provider is an implementation change behind this
 * same port.
 */
export class SimulatedSignatureProvider implements SignaturePort {
  readonly name = "simulated-signature";
  private readonly envelopes = new Map<string, StoredEnvelope>();

  async create(
    input: { applicationId: string; documentHash: string; signerName: string },
    _meta: ProviderCallMeta,
  ): Promise<SignatureEnvelope> {
    const envelopeId = `env_${randomUUID()}`;
    const expiresAt = Date.now() + ENVELOPE_TTL_MS;

    this.envelopes.set(envelopeId, {
      applicationId: input.applicationId,
      documentHash: input.documentHash,
      signerName: input.signerName,
      expiresAt,
      signedAt: null,
      evidenceHash: null,
      signatureHash: null,
    });

    return {
      envelopeId,
      status: "CREATED",
      expiresAt: new Date(expiresAt).toISOString(),
      signedAt: null,
      documentHash: input.documentHash,
      evidenceHash: null,
      signatureHash: null,
    };
  }

  async sign(
    input: { envelopeId: string; signatureImage: Buffer },
    _meta: ProviderCallMeta,
  ): Promise<SignatureEnvelope> {
    const envelope = this.envelopes.get(input.envelopeId);
    if (!envelope) throw new Error("Unknown signature envelope");

    const shared = {
      envelopeId: input.envelopeId,
      expiresAt: new Date(envelope.expiresAt).toISOString(),
      documentHash: envelope.documentHash,
    };

    // Signing twice returns the first signature rather than making a second:
    // a resubmitted form must not produce two proofs of the same act.
    if (envelope.signedAt) {
      return {
        ...shared,
        status: "SIGNED",
        signedAt: envelope.signedAt,
        evidenceHash: envelope.evidenceHash,
        signatureHash: envelope.signatureHash,
      };
    }
    if (Date.now() > envelope.expiresAt) {
      return { ...shared, status: "EXPIRED", signedAt: null, evidenceHash: null, signatureHash: null };
    }

    // An empty canvas posts a valid but nearly blank PNG. Refusing it here
    // keeps "signed" meaning that somebody actually drew something.
    if (input.signatureImage.byteLength < MIN_SIGNATURE_BYTES) {
      return { ...shared, status: "FAILED", signedAt: null, evidenceHash: null, signatureHash: null };
    }

    const signedAt = new Date().toISOString();
    const signatureHash = createHash("sha256").update(input.signatureImage).digest("hex");
    const evidenceHash = createHash("sha256")
      .update(
        [envelope.documentHash, envelope.applicationId, envelope.signerName, signedAt, signatureHash].join("|"),
        "utf8",
      )
      .digest("hex");

    envelope.signedAt = signedAt;
    envelope.signatureHash = signatureHash;
    envelope.evidenceHash = evidenceHash;

    return { ...shared, status: "SIGNED", signedAt, evidenceHash, signatureHash };
  }
}
