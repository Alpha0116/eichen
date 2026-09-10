import { roundMinor, type Minor } from "../finance/money";
import type { AffordabilityConfig } from "./types";

export interface HouseholdInput {
  netMonthlyIncome: Minor;
  coBorrowerNetMonthlyIncome: Minor;
  /** Child benefit, rental income, maintenance received. */
  otherMonthlyIncome: Minor;
  adults: number;
  children: number;
  /** Rent including charges, or the mortgage instalment for an owner. */
  monthlyHousingCost: Minor;
  /** Instalments of loans already running. */
  existingLoanInstalments: Minor;
  /** Insurance, maintenance paid, alimony, leasing. */
  otherFixedCosts: Minor;
}

export interface AffordabilityResult {
  totalIncome: Minor;
  livingAllowance: Minor;
  totalCommitments: Minor;
  disposableIncome: Minor;
  /** Largest instalment the household can carry under both constraints. */
  maxAffordableInstalment: Minor;
  /** Existing debt service over net income, before the new loan. */
  currentDebtServiceRatio: number;
  binding: "DISPOSABLE" | "DEBT_SERVICE" | "NONE";
}

/**
 * Household budget (Haushaltsrechnung) in the shape German lenders use: income
 * minus a per-head living allowance, housing and existing commitments.
 *
 * Two independent ceilings apply and the tighter one wins — a high earner with
 * heavy existing debt is limited by the debt-service ratio even when their
 * disposable income looks comfortable.
 */
export function assessAffordability(
  input: HouseholdInput,
  config: AffordabilityConfig,
): AffordabilityResult {
  const adults = Math.max(1, Math.floor(input.adults));
  const children = Math.max(0, Math.floor(input.children));

  const totalIncome =
    input.netMonthlyIncome + input.coBorrowerNetMonthlyIncome + input.otherMonthlyIncome;

  const livingAllowance =
    config.baseAllowanceFirstAdult +
    config.baseAllowancePerAdditionalAdult * (adults - 1) +
    config.baseAllowancePerChild * children;

  const totalCommitments =
    input.monthlyHousingCost + input.existingLoanInstalments + input.otherFixedCosts;

  const disposableIncome = totalIncome - livingAllowance - totalCommitments;

  const disposableCeiling = roundMinor(
    Math.max(0, disposableIncome) * config.maxInstalmentShareOfDisposable,
  );
  const debtServiceCeiling = roundMinor(
    Math.max(0, totalIncome * config.maxDebtServiceRatio - input.existingLoanInstalments),
  );

  const maxAffordableInstalment = Math.max(0, Math.min(disposableCeiling, debtServiceCeiling));
  const binding =
    maxAffordableInstalment === 0
      ? "NONE"
      : debtServiceCeiling < disposableCeiling
        ? "DEBT_SERVICE"
        : "DISPOSABLE";

  return {
    totalIncome,
    livingAllowance,
    totalCommitments,
    disposableIncome,
    maxAffordableInstalment,
    currentDebtServiceRatio: totalIncome > 0 ? input.existingLoanInstalments / totalIncome : 1,
    binding,
  };
}
