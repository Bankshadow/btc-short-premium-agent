import type {
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { RelevantMemoryResult } from "@/lib/memory-graph/types";
import type { SpotQuote } from "@/lib/types/market";
import type { RegimeBrainInput } from "./types";

/** Reconstruct full engine input from analyze output (cron/detect paths). */
export function buildEngineInputFromAnalyzeResponse(
  response: AnalyzeApiResponse,
  partial?: Partial<DecisionEngineInput>,
): DecisionEngineInput {
  return {
    market: response.marketSnapshot ?? response.step1_marketSnapshot,
    optionCandidates: response.optionCandidates,
    technicalDaily: response.technical.daily,
    technical4h: response.technical.h4,
    technical1h: response.technical.h1,
    macroEvent: response.macroEvent,
    liquidation: response.liquidation,
    ...partial,
  };
}

export function buildRegimeBrainInputFromAnalyze(input: {
  response: AnalyzeApiResponse;
  partialEngine?: Partial<DecisionEngineInput>;
  ethQuote?: SpotQuote | null;
  recentEntries?: DecisionLogEntry[];
  relevantMemory?: RelevantMemoryResult;
}): RegimeBrainInput {
  return {
    input: buildEngineInputFromAnalyzeResponse(
      input.response,
      input.partialEngine,
    ),
    response: input.response,
    ethQuote: input.ethQuote ?? null,
    recentEntries: input.recentEntries ?? [],
    relevantMemory: input.relevantMemory,
  };
}
