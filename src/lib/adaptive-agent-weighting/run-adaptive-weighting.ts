import { computeWeightedCommitteeVerdict } from "./compute-weighted-verdict";
import type { AdaptiveWeightingInput, WeightedCommitteeVerdict } from "./types";

export function runAdaptiveWeighting(
  input: AdaptiveWeightingInput,
): WeightedCommitteeVerdict | null {
  return computeWeightedCommitteeVerdict(input);
}
