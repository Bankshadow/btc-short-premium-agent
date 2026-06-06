import type { StrategySource, SuggestedUse } from "./types";

function useLabel(use: SuggestedUse): string {
  const map: Record<SuggestedUse, string> = {
    ENTRY: "entry signal layer",
    EXIT: "exit / take-profit layer",
    FILTER: "regime or setup filter",
    RISK_GATE: "risk veto gate",
    RESEARCH_ONLY: "research sandbox only",
  };
  return map[use];
}

/**
 * Deterministic AI-style review summary for imported quant strategies.
 * Advisory only — does not call external LLMs or enable execution.
 */
export function buildAiReviewSummary(source: StrategySource, input: {
  thesis: string;
  marketRegimeFit: string[];
  cryptoAdaptationNotes: string[];
  suggestedUse: SuggestedUse;
}): string {
  const regime =
    input.marketRegimeFit.length > 0
      ? input.marketRegimeFit.join(", ")
      : "mixed regimes";
  const adaptation =
    input.cryptoAdaptationNotes[0] ??
    "Validate on BTC/SOL perp data before any paper use.";
  const risk =
    source.riskNotes[0] ?? "Treat as unvalidated until backtested on crypto.";

  return [
    `${source.strategyName} from ${source.repoName} is staged as research-only.`,
    `Thesis: ${input.thesis}`,
    `Best regime fit for BTC/SOL: ${regime}.`,
    `Suggested desk role: ${useLabel(input.suggestedUse)} — not live execution.`,
    `Crypto note: ${adaptation}`,
    `Risk: ${risk}`,
    "Next step: promote to backtest after human review; paper/testnet requires separate approval.",
  ].join(" ");
}
