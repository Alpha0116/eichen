import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, KeyValue } from "@/components/ui";
import { ContactButtons } from "@/components/ContactButtons";
import { funnelStep, type ApplicationState } from "@/domain/application/states";
import type { CurrencyCode } from "@/domain/finance/money";
import { getDictionary, interpolate, type Locale } from "@/i18n";
import { formatDate, formatMoney } from "@/i18n/format";
import { requireApplicationAccess } from "@/server/access";
import { mailtoLink } from "@/server/config";
import { db } from "@/server/db";
import { accountFee } from "@/server/services/accountFee";
import {
  accountSpaceDetails,
  transferCodeFor,
  TRANSFER_CODE_MAX_ATTEMPTS,
} from "@/server/services/accountSpace";
import { requestTransferAction } from "../../actions";
import { TransferForm } from "./TransferForm";

/**
 * Step 5. The borrower's account space.
 *
 * The granted amount is shown as the balance of an account, with a card and
 * the bank details an administrator set in the back office. Transferring it
 * out asks for a confirmation code that only support hands out, by email;
 * the borrower can stop here, and the file waits for them.
 *
 * The fee receipt stays underneath, because it is still the one thing the
 * borrower wants proof of after paying.
 */
export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireApplicationAccess(id);

  const [application, fee, details] = await Promise.all([
    db.application.findUniqueOrThrow({
      where: { id },
      select: {
        state: true,
        reference: true,
        grantedAmount: true,
        amount: true,
        currency: true,
        maskedIban: true,
        transferCodeAttempts: true,
        transferRequestedAt: true,
        applicants: { where: { role: "PRIMARY" }, select: { firstName: true, lastName: true } },
      },
    }),
    accountFee(id),
    accountSpaceDetails(),
  ]);

  const state = application.state as ApplicationState;
  if (funnelStep(state) < 5) redirect(`/${locale}/apply/${id}/fee`);

  // The code exists from the moment the space does, so support can read it
  // off the file before the borrower has even asked.
  await transferCodeFor(id);

  const dictionary = getDictionary(locale);
  const typedLocale = locale as Locale;
  const t = dictionary.funnel.processing;
  const currency = application.currency as CurrencyCode;
  const balance = application.grantedAmount ?? application.amount;
  const primary = application.applicants[0];
  const borrowerName = primary ? `${primary.firstName} ${primary.lastName}` : "";
  const holder = details.accountHolder.trim() || borrowerName;
  const cardDigits = details.cardNumber.replace(/\D/g, "");
  const settled = state === "DISBURSED" || state === "ACTIVE";
  const requestTransfer = requestTransferAction.bind(null, locale, id);

  return (
    <div className="space-y-6">
      <Card elevation="md" className="space-y-6 p-6 sm:p-10">
        <div>
          <h2 className="text-[length:var(--text-h2)] font-semibold tracking-tight">{t.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t.body}</p>
        </div>

        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
          {/* The card is a picture of the account, not a payment form: it only
              ever shows the last four digits, whatever was saved behind it. */}
          <div
            role="img"
            aria-label={`${t.cardLabel}: ${details.bankName}, •••• ${cardDigits.slice(-4)}`}
            className="relative aspect-[1.586] w-full max-w-[20rem] overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--primary)] via-[color-mix(in_srgb,var(--primary)_80%,black)] to-[color-mix(in_srgb,var(--primary)_55%,black)] p-5 text-white shadow-[var(--shadow-lg)]"
          >
            <div aria-hidden className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-[var(--accent)]/20" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold tracking-wide">{details.bankName}</span>
                <span aria-hidden className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
              </div>
              <p className="tabular text-lg tracking-[0.18em] sm:text-xl">
                •••• •••• •••• {cardDigits.slice(-4)}
              </p>
              <div className="flex items-end justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="uppercase tracking-wide text-white/60">{t.cardHolder}</p>
                  <p className="truncate font-medium uppercase">{holder || "—"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="uppercase tracking-wide text-white/60">{t.cardValid}</p>
                  <p className="tabular font-medium">{details.cardExpiry}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.available}</p>
              <p className="tabular mt-1 text-4xl font-bold tracking-tight text-[var(--figure-emphasis)]">
                {formatMoney(balance, typedLocale, currency)}
              </p>
              {application.transferRequestedAt && !settled ? (
                <p className="mt-1 text-sm font-medium text-[var(--warning)]">{t.pending}</p>
              ) : null}
            </div>
            <KeyValue
              rows={[
                { label: t.accountHolder, value: holder || "—" },
                { label: t.iban, value: details.iban },
                { label: t.bic, value: details.bic },
                { label: t.bank, value: details.bankName },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-6 sm:p-8">
        <div>
          <h3 className="text-[length:var(--text-h3)] font-semibold">{t.transferTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t.transferIntro}</p>
        </div>
        <KeyValue
          rows={[
            { label: t.transferTo, value: application.maskedIban ?? t.transferToMissing },
            { label: t.transferAmount, value: formatMoney(balance, typedLocale, currency) },
          ]}
        />
        {application.transferRequestedAt ? (
          <Alert tone="positive" title={t.requestedTitle}>
            {interpolate(t.requestedBody, {
              date: formatDate(application.transferRequestedAt, typedLocale),
            })}
          </Alert>
        ) : (
          <TransferForm
            dictionary={dictionary}
            action={requestTransfer}
            reference={application.reference}
            requestCodeHref={mailtoLink(`${t.requestCodeSubject} ${application.reference}`)}
            locked={application.transferCodeAttempts >= TRANSFER_CODE_MAX_ATTEMPTS}
          />
        )}
      </Card>

      {fee ? (
        <Card className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">{t.feeTitle}</h3>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feeAmount}</dt>
              <dd className="tabular mt-0.5 font-semibold">
                {formatMoney(fee.amount, typedLocale, fee.currency as CurrencyCode)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feeReference}</dt>
              <dd className="tabular mt-0.5 font-medium">{fee.reference}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feeMethod}</dt>
              <dd className="mt-0.5 font-medium">
                {/* A fee settled with support has no card behind it, so it
                    says how it was arranged rather than showing a dash. */}
                {fee.cardLast4
                  ? interpolate(dictionary.fee.cardOnFile, {
                      brand: fee.cardBrand ?? "",
                      last4: fee.cardLast4,
                    })
                  : fee.method
                    ? dictionary.fee.manualOnFile
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.feePaidAt}</dt>
              <dd className="tabular mt-0.5 font-medium">
                {fee.paidAt ? formatDate(fee.paidAt, typedLocale) : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--muted)]">
            {interpolate(t.doneHint, { reference: application.reference })}
          </p>
          {settled ? (
            <Link href={`/${locale}/account`} className="inline-block text-sm font-medium underline underline-offset-2">
              {t.toAccount}
            </Link>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-3 p-5">
        <h3 className="text-[length:var(--text-h3)] font-semibold">{dictionary.contact.title}</h3>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{dictionary.contact.waitingBody}</p>
        <ContactButtons dictionary={dictionary} reference={application.reference} />
      </Card>
    </div>
  );
}
