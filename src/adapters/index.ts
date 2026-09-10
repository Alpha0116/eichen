import { SimulatedAccountCheck } from "./simulated/accountCheck";
import { SimulatedCreditBureau } from "./simulated/bureau";
import { SimulatedIdentityProvider } from "./simulated/identity";
import { SimulatedNotificationProvider } from "./simulated/notifications";
import { SimulatedPaymentProvider } from "./simulated/payments";
import { SimulatedSignatureProvider } from "./simulated/signature";
import { SmtpNotificationProvider, smtpSettingsFromEnv } from "./smtp/notifications";
import type {
  AccountCheckPort,
  CreditBureauPort,
  IdentityPort,
  NotificationPort,
  PaymentPort,
  SignaturePort,
} from "./ports";

export interface ProviderRegistry {
  bureau: CreditBureauPort;
  accountCheck: AccountCheckPort;
  identity: IdentityPort;
  signature: SimulatedSignatureProvider & SignaturePort;
  payments: PaymentPort;
  notifications: NotificationPort;
}

/**
 * Single place where implementations are bound.
 *
 * Providers hold in-process state (open sessions, pending envelopes), so they
 * are cached on `globalThis`: the dev server re-evaluates modules on every hot
 * reload, and a fresh registry each time would drop the borrower's half-finished
 * identity session. A real deployment binds licensed providers here instead.
 */
const globalRegistry = globalThis as unknown as { __eichenProviders?: ProviderRegistry };

export function providers(): ProviderRegistry {
  if (!globalRegistry.__eichenProviders) {
    const smtp = smtpSettingsFromEnv();
    globalRegistry.__eichenProviders = {
      bureau: new SimulatedCreditBureau(),
      accountCheck: new SimulatedAccountCheck(),
      identity: new SimulatedIdentityProvider(),
      signature: new SimulatedSignatureProvider(),
      payments: new SimulatedPaymentProvider(),
      // Real mail the moment SMTP_HOST is configured, and the in-memory
      // outbox otherwise — so a fresh checkout and the test suites never
      // reach for a mail server that is not there.
      notifications: smtp ? new SmtpNotificationProvider(smtp) : new SimulatedNotificationProvider(),
    };
  }
  return globalRegistry.__eichenProviders;
}

export * from "./ports";
