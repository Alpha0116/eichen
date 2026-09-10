import type { BureauResult } from "../../domain/application/types";
import { chance, createRng, pickInt, seedFrom } from "../deterministic";
import { shouldFail } from "./faults";
import type { BureauQuery, CreditBureauPort, ProviderCallMeta } from "../ports";

/**
 * Stand-in for a credit bureau (SCHUFA and equivalents).
 *
 * It deliberately produces the awkward cases as well as the happy one: a
 * fraction of applicants come back with a negative item, a thin file, or no
 * answer at all. A funnel that has only ever seen a clean response is a funnel
 * that will break on its first real outage.
 */
export class SimulatedCreditBureau implements CreditBureauPort {
  readonly name = "simulated-bureau";

  async check(query: BureauQuery, meta: ProviderCallMeta): Promise<BureauResult> {
    const rng = createRng(
      seedFrom("bureau", query.lastName, query.birthDate, query.postalCode),
    );

    // Unavailability is a property of the attempt, not of the person: a retry
    // can succeed where the first call did not.
    const unavailable = shouldFail(0.06, "bureau-up", query.applicationId, meta.attempt);
    if (unavailable) {
      return {
        status: "UNAVAILABLE",
        score: null,
        negativeItems: null,
        thinFile: false,
        enquiryType: query.enquiryType,
        checkedAt: new Date().toISOString(),
      };
    }

    const thinFile = chance(rng, 0.12);
    const negativeItems = chance(rng, 0.1) ? pickInt(rng, 1, 3) : 0;
    // Thin files sit lower not because the person is worse, but because there
    // is less to go on — which is why the rule set only penalises them lightly.
    const score = thinFile ? pickInt(rng, 55, 78) : pickInt(rng, 48, 99);

    return {
      status: negativeItems > 0 ? "SOFT_NEGATIVE" : "SOFT_OK",
      score,
      negativeItems,
      thinFile,
      enquiryType: query.enquiryType,
      checkedAt: new Date().toISOString(),
    };
  }
}
