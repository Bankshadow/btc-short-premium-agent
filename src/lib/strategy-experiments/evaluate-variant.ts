import type { AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import type { ExperimentMode, StrategyVariant } from "./types";

function entryText(entry: DecisionLogEntry): string {
  return [
    entry.marketRegime,
    ...entry.topReasons,
    ...entry.agentOutputs.flatMap((a) => [...a.reasons, ...a.risks]),
  ]
    .join(" ")
    .toLowerCase();
}

function regimeMatches(target: string, entry: DecisionLogEntry): boolean {
  if (!target.trim()) return true;
  return entry.marketRegime.toLowerCase().includes(target.toLowerCase().slice(0, 8));
}

function assetMatches(target: string, entry: DecisionLogEntry, orders?: PaperOrder[]): boolean {
  if (!target.trim() || target === "*") return true;
  const order = orders?.find((o) => o.decisionLogId === entry.id);
  const symbol = order?.symbol ?? "BTCUSDT";
  return symbol.toLowerCase().includes(target.toLowerCase().replace("usdt", ""));
}

export function variantShadowVerdict(
  entry: DecisionLogEntry,
  variant: StrategyVariant,
  mode: ExperimentMode,
  orders?: PaperOrder[],
): AgentRecommendation {
  if (entry.outcomeStatus !== "RESOLVED") return "WAIT";

  if (!regimeMatches(variant.targetRegime, entry)) return "SKIP";
  if (!assetMatches(variant.targetAsset, entry, orders)) return "SKIP";

  const signaled = strategiesSignaledOnEntry(entry);
  if (!signaled.includes(variant.targetStrategy)) return "SKIP";

  const text = entryText(entry);
  const entryCond = variant.entryCondition.toLowerCase();

  for (const rule of variant.modifiedRules) {
    const r = rule.toLowerCase();
    if (r.includes("block") && r.includes("liquidation") && text.includes("liquidation")) {
      return "SKIP";
    }
    if (r.includes("block") && r.includes("macro") && text.includes("macro")) {
      return "SKIP";
    }
    if (r.includes("block") && r.includes("funding") && text.includes("funding")) {
      return "SKIP";
    }
    if (r.includes("caution") && entry.riskVeto) return "SKIP";
  }

  if (entryCond.includes("risk veto") && entry.riskVeto) return "SKIP";
  if (entryCond.includes("data quality") && entry.agentOutputs.some((a) => a.missingData.length > 2)) {
    return mode === "strict_paper" ? "SKIP" : "WAIT";
  }
  if (entryCond.includes("committee align") && entry.finalVerdict === "SKIP") {
    return mode === "relaxed_paper" ? "TRADE" : "SKIP";
  }

  for (const limit of variant.riskLimits) {
    const l = limit.toLowerCase();
    if (l.includes("max loss") && (entry.paperPnl ?? 0) < -3) return "SKIP";
    if (l.includes("veto") && entry.riskVeto) return "SKIP";
  }

  if (mode === "strict_paper") {
    if (entry.finalVerdict !== "TRADE") return "SKIP";
    if (entry.riskVeto) return "SKIP";
    return "TRADE";
  }

  if (mode === "relaxed_paper") {
    if (entry.riskVeto) return "SKIP";
    const options = entry.agentOutputs.find((a) => a.strategyType === "OPTIONS");
    if (options?.recommendation === "TRADE") return "TRADE";
    if (entry.finalVerdict === "TRADE") return "TRADE";
    return "WAIT";
  }

  if (mode === "forward_paper_shadow" || mode === "historical_replay") {
    if (entry.riskVeto) return "SKIP";
    if (entry.finalVerdict === "TRADE") return "TRADE";
    if (entryCond.includes("aggressive")) return "TRADE";
    return "SKIP";
  }

  return entry.finalVerdict;
}

export function hypotheticalPnl(
  shadowVerdict: AgentRecommendation,
  entry: DecisionLogEntry,
): number | null {
  if (shadowVerdict !== "TRADE") return 0;
  return entry.paperPnl;
}
