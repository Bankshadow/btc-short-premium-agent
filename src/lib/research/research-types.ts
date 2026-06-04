import type { AgentOutput } from "@/lib/agents/types";
import type { SpotQuote } from "@/lib/types/market";

export interface EthCorrelationRead {
  ethPrice: number | null;
  ethChange24hPct: number | null;
  btcChange24hPct: number | null;
  alignment: "aligned" | "divergent" | "unknown";
  summary: string;
}

/** MVP 5 — research layer output fed into thesis/strategy agents. */
export interface ResearchBrief {
  generatedAt: string;
  regimeLabel: string;
  dataQualityScore: number;
  ethCorrelation: EthCorrelationRead;
  marketData: AgentOutput;
  regime: AgentOutput;
  dataQuality: AgentOutput;
  macroNews: AgentOutput;
  agents: AgentOutput[];
  summaryBullets: string[];
}

export interface ResearchLayerInput {
  ethQuote?: SpotQuote | null;
}
