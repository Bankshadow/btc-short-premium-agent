import { estimatePositionGreeks } from "@/lib/options-risk-greeks/estimate-greeks";
import type { OptionCandidate } from "@/lib/types/market";
import type { OptionsInstrument } from "@/lib/options-execution/types";
import type { OptionsDryRunGreeks } from "./types";

export function estimateOptionsGreeks(input: {
  instrument: OptionsInstrument | null;
  candidate?: OptionCandidate | null;
  spotPrice?: number;
  hoursToExpiry?: number;
  contracts?: number;
  side?: "short" | "long";
}): OptionsDryRunGreeks {
  const raw = estimatePositionGreeks({
    instrument: input.instrument,
    candidate: input.candidate,
    spotPrice: input.spotPrice,
    hoursToExpiry: input.hoursToExpiry,
    contracts: input.contracts ?? 1,
    side: input.side ?? "short",
  });
  return {
    delta: raw.delta,
    gamma: raw.gamma,
    theta: raw.theta,
    vega: raw.vega,
    iv: raw.iv,
  };
}
