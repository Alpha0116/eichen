import type { LenderProduct } from "./types";

/**
 * The product.
 *
 * There is exactly one, on Eichen's own book, at a flat 3 % nominal per year.
 * The rate carries no risk spread, no purpose adjustment and no term
 * surcharge: `gradeSpread` is zero across every band, `purposeAdjustment` is
 * empty, and `longTermAdjustment` is zero. Those fields survive on the type
 * because the pricing function still reads them — setting them to zero is how
 * a single flat rate is expressed, and it keeps the arithmetic in one place
 * instead of introducing a second, untested pricing path.
 *
 * `commissionBps` is zero and `sponsored` is false: with nothing to compare
 * against, there is no placement to sell and no commission to disclose.
 */
export const EICHEN_PRODUCT_ID = "eichen-kredit";

/** The single nominal rate, mirrored from PRODUCT.referenceRate. */
export const NOMINAL_RATE = 0.03;

export const LENDER_CATALOGUE: LenderProduct[] = [
  {
    id: EICHEN_PRODUCT_ID,
    lenderName: "Eichen Bank",
    lenderKind: "BANK",
    supervisionNote: "lender.supervision.own_book",
    country: "DE",
    currency: "EUR",
    minAmount: 100_000,
    maxAmount: 8_000_000,
    minTermMonths: 12,
    maxTermMonths: 120,
    baseRate: NOMINAL_RATE,
    gradeSpread: { A: 0, B: 0, C: 0, D: 0 },
    purposeAdjustment: {},
    longTermThresholdMonths: 120,
    longTermAdjustment: 0,
    allowedPurposes: [
      "FREE_USE",
      "VEHICLE",
      "RENOVATION",
      "DEBT_CONSOLIDATION",
      "FURNITURE",
      "EDUCATION",
      "MEDICAL",
      "TRAVEL",
    ],
    // Every employment type is admissible at this stage. Whether the file
    // holds up is an administrator's judgement, made on the whole picture,
    // not a gate the catalogue closes before a person has looked.
    allowedEmployment: [
      "PERMANENT",
      "FIXED_TERM",
      "PROBATION",
      "CIVIL_SERVANT",
      "SELF_EMPLOYED",
      "PENSIONER",
      "STUDENT",
      "PARENTAL_LEAVE",
      "UNEMPLOYED",
    ],
    minNetMonthlyIncome: 0,
    minAge: 18,
    maxAgeAtMaturity: 80,
    requiresBankCheck: false,
    features: {
      freeEarlyRepayment: true,
      paymentHolidaysPerYear: 2,
      instantDecision: false,
      coBorrowerAllowed: true,
    },
    // No residual-debt insurance is offered, so there is no optional cover to
    // price, to pre-tick, or to keep out of the APR.
    insurancePremiumRate: null,
    commissionBps: 0,
    sponsored: false,
    expectedPayoutDays: 2,
  },
];
