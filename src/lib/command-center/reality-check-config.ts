import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { DEFAULT_GOVERNANCE_STATE } from "@/lib/governance/governance-state";

export const REALITY_CHECK_THRESHOLDS = {
  minResolvedSamplesPerStrategy: VALIDATION_THRESHOLDS.minSignalsForActive,
  minValidationResolvedSamples: VALIDATION_THRESHOLDS.minSignalsForActive,
  minPaperClosedTrades: 1,
  placeholderOperatorName: DEFAULT_GOVERNANCE_STATE.operatorName,
  placeholderOperatorRole: "TRADER",
} as const;

export const REALITY_CHECK_SAFETY_NOTICE =
  "Reality check is read-only — it cannot enable live execution or increase risk.";
