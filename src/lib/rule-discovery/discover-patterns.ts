import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { TradeEvaluationResult } from "@/lib/self-learning/types";
import type { MemoryGraphSnapshot } from "@/lib/memory-graph/types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { DiscoveredPattern, DiscoveredRuleType } from "./types";

function patternId(category: string, key: string): string {
  return `pat-${category}-${key.replace(/[^a-z0-9]+/gi, "-").slice(0, 32)}`;
}

function addPattern(
  patterns: DiscoveredPattern[],
  seen: Set<string>,
  pattern: DiscoveredPattern,
) {
  const key = `${pattern.category}-${pattern.condition}`;
  const minSample =
    pattern.category === "agent_weakness" || pattern.category === "memory_lesson"
      ? 1
      : 2;
  if (seen.has(key) || pattern.sampleSize < minSample) return;
  seen.add(key);
  patterns.push(pattern);
}

export function discoverPatterns(input: {
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
  evaluations?: TradeEvaluationResult[];
  memoryGraph?: MemoryGraphSnapshot;
  registryStrategies?: StrategySkill[];
}): DiscoveredPattern[] {
  const patterns: DiscoveredPattern[] = [];
  const seen = new Set<string>();
  const resolved = input.entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const orders = input.orders ?? [];

  const byRegime = new Map<
    string,
    { ids: string[]; wins: number; pnl: number }
  >();
  for (const entry of resolved) {
    const stat = byRegime.get(entry.marketRegime) ?? { ids: [], wins: 0, pnl: 0 };
    stat.ids.push(entry.id);
    const pnl = entry.paperPnl ?? 0;
    stat.pnl += pnl;
    if (entry.resolution?.tradeWouldWin === true || pnl > 0) stat.wins += 1;
    byRegime.set(entry.marketRegime, stat);
  }

  for (const [regime, stat] of byRegime) {
    const winRate = Math.round((stat.wins / stat.ids.length) * 100);
    const avgPnl = stat.pnl / stat.ids.length;
    if (avgPnl < -1 && stat.ids.length >= 2) {
      addPattern(patterns, seen, {
        patternId: patternId("regime_loss", regime),
        category: "regime_loss",
        condition: `Block or caution TRADE in ${regime}`,
        rationale: `${stat.ids.length} resolved sessions averaged ${avgPnl.toFixed(1)}% PnL.`,
        supportingTradeIds: stat.ids.slice(0, 8),
        winRate,
        avgPnlPct: Number(avgPnl.toFixed(2)),
        sampleSize: stat.ids.length,
        suggestedRuleType: "BLOCK",
        suggestedScope: { regime },
        confidence: Math.min(90, 50 + stat.ids.length * 8),
      });
    }
    if (winRate >= 60 && avgPnl > 0 && stat.ids.length >= 2) {
      addPattern(patterns, seen, {
        patternId: patternId("regime_win", regime),
        category: "regime_win",
        condition: `Allow paper concentration in ${regime}`,
        rationale: `Win rate ${winRate}% with avg +${avgPnl.toFixed(1)}% PnL.`,
        supportingTradeIds: stat.ids.slice(0, 8),
        winRate,
        avgPnlPct: Number(avgPnl.toFixed(2)),
        sampleSize: stat.ids.length,
        suggestedRuleType: "ALLOW_PAPER",
        suggestedScope: { regime },
        confidence: Math.min(85, 45 + stat.ids.length * 6),
      });
    }
  }

  const liquidationLosses = resolved.filter(
    (e) =>
      e.marketRegime.toLowerCase().includes("liquidation") &&
      (e.paperPnl ?? 0) < 0,
  );
  if (liquidationLosses.length >= 2) {
    addPattern(patterns, seen, {
      patternId: patternId("liquidation", "cluster"),
      category: "liquidation_risk",
      condition: "Block short premium near liquidation cluster",
      rationale: `${liquidationLosses.length} losses in liquidation stress regime.`,
      supportingTradeIds: liquidationLosses.map((e) => e.id),
      winRate: 0,
      avgPnlPct: Number(
        (
          liquidationLosses.reduce((s, e) => s + (e.paperPnl ?? 0), 0) /
          liquidationLosses.length
        ).toFixed(2),
      ),
      sampleSize: liquidationLosses.length,
      suggestedRuleType: "BLOCK",
      suggestedScope: { regime: "Liquidation" },
      confidence: 78,
    });
  }

  const macroLosses = resolved.filter(
    (e) =>
      e.marketRegime.toLowerCase().includes("macro") &&
      (e.paperPnl ?? 0) < 0,
  );
  if (macroLosses.length >= 2) {
    addPattern(patterns, seen, {
      patternId: patternId("macro", "failure"),
      category: "macro_failure",
      condition: "CAUTION: macro event week — reduce size or SKIP options TRADE",
      rationale: `${macroLosses.length} macro-caution sessions ended negative.`,
      supportingTradeIds: macroLosses.map((e) => e.id),
      winRate: 0,
      avgPnlPct: Number(
        (
          macroLosses.reduce((s, e) => s + (e.paperPnl ?? 0), 0) /
          macroLosses.length
        ).toFixed(2),
      ),
      sampleSize: macroLosses.length,
      suggestedRuleType: "CAUTION",
      suggestedScope: { regime: "Macro" },
      confidence: 75,
    });
  }

  const ivFailures = resolved.filter((e) => {
    const text = [...e.topReasons, ...e.agentOutputs.flatMap((a) => a.reasons)]
      .join(" ")
      .toLowerCase();
    return (
      (text.includes("iv/hv") || text.includes("low iv") || text.includes("hv30")) &&
      (e.paperPnl ?? 0) < 0 &&
      e.finalVerdict === "TRADE"
    );
  });
  if (ivFailures.length >= 2) {
    addPattern(patterns, seen, {
      patternId: patternId("iv_hv", "failure"),
      category: "iv_hv_failure",
      condition: "Block TRADE when IV/HV ratio unfavorable or HV30 missing",
      rationale: `${ivFailures.length} TRADE losses with weak IV/HV context.`,
      supportingTradeIds: ivFailures.map((e) => e.id),
      winRate: 0,
      avgPnlPct: Number(
        (
          ivFailures.reduce((s, e) => s + (e.paperPnl ?? 0), 0) / ivFailures.length
        ).toFixed(2),
      ),
      sampleSize: ivFailures.length,
      suggestedRuleType: "BLOCK",
      suggestedScope: { productType: "OPTIONS" },
      confidence: 72,
    });
  }

  const fundingLosses = resolved.filter((e) => {
    const text = e.topReasons.join(" ").toLowerCase();
    return text.includes("funding") && (e.paperPnl ?? 0) < 0;
  });
  if (fundingLosses.length >= 2) {
    addPattern(patterns, seen, {
      patternId: patternId("funding", "stress"),
      category: "funding_stress",
      condition: "Block futures TRADE when funding stress elevated",
      rationale: `${fundingLosses.length} losses with funding stress signals.`,
      supportingTradeIds: fundingLosses.map((e) => e.id),
      winRate: 0,
      avgPnlPct: Number(
        (
          fundingLosses.reduce((s, e) => s + (e.paperPnl ?? 0), 0) /
          fundingLosses.length
        ).toFixed(2),
      ),
      sampleSize: fundingLosses.length,
      suggestedRuleType: "BLOCK",
      suggestedScope: { productType: "FUTURES" },
      confidence: 70,
    });
  }

  const disagreementLosses = resolved.filter((e) => {
    const bull = e.agentOutputs.find((a) => a.agentName === "Bull Thesis Agent");
    const bear = e.agentOutputs.find((a) => a.agentName === "Bear Thesis Agent");
    return (
      bull?.recommendation === "TRADE" &&
      bear?.recommendation === "SKIP" &&
      (e.paperPnl ?? 0) < 0
    );
  });
  if (disagreementLosses.length >= 2) {
    addPattern(patterns, seen, {
      patternId: patternId("disagreement", "bull_bear"),
      category: "agent_disagreement",
      condition: "WAIT when Bull TRADE conflicts with Bear SKIP",
      rationale: `${disagreementLosses.length} losses when bull/bear disagreed.`,
      supportingTradeIds: disagreementLosses.map((e) => e.id),
      winRate: 0,
      avgPnlPct: Number(
        (
          disagreementLosses.reduce((s, e) => s + (e.paperPnl ?? 0), 0) /
          disagreementLosses.length
        ).toFixed(2),
      ),
      sampleSize: disagreementLosses.length,
      suggestedRuleType: "CAUTION",
      suggestedScope: {},
      confidence: 74,
    });
  }

  const falseSkips = resolved.filter((e) => e.falseSkipFlag === true);
  if (falseSkips.length >= 2) {
    addPattern(patterns, seen, {
      patternId: patternId("skip", "opportunity"),
      category: "excessive_skip",
      condition: "REVIEW: committee SKIP missed winning paper setups",
      rationale: `${falseSkips.length} false SKIP flags — opportunity cost detected.`,
      supportingTradeIds: falseSkips.map((e) => e.id),
      winRate: 0,
      avgPnlPct: Number(
        (
          falseSkips.reduce((s, e) => s + (e.missedOpportunityR ?? 0), 0) /
          falseSkips.length
        ).toFixed(2),
      ),
      sampleSize: falseSkips.length,
      suggestedRuleType: "REVIEW",
      suggestedScope: {},
      confidence: 68,
    });
  }

  const relaxedClosed = orders.filter(
    (o) => o.status === "CLOSED" && o.paperMode === "RELAXED_PAPER",
  );
  const strictClosed = orders.filter(
    (o) => o.status === "CLOSED" && o.paperMode === "STRICT_PAPER",
  );
  const relaxedPnl =
    relaxedClosed.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0) /
    Math.max(1, relaxedClosed.length);
  const strictPnl =
    strictClosed.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0) /
    Math.max(1, strictClosed.length);
  if (relaxedClosed.length >= 2 && relaxedPnl > strictPnl + 0.5) {
    addPattern(patterns, seen, {
      patternId: patternId("relaxed", "outperform"),
      category: "relaxed_outperform",
      condition: "ALLOW_PAPER: relaxed paper mode outperformed strict in sample",
      rationale: `Relaxed avg ${relaxedPnl.toFixed(1)}% vs strict ${strictPnl.toFixed(1)}%.`,
      supportingTradeIds: relaxedClosed.map((o) => o.decisionLogId).slice(0, 8),
      winRate: Math.round(
        (relaxedClosed.filter((o) => (o.realizedPnlPct ?? 0) > 0).length /
          relaxedClosed.length) *
          100,
      ),
      avgPnlPct: Number(relaxedPnl.toFixed(2)),
      sampleSize: relaxedClosed.length,
      suggestedRuleType: "ALLOW_PAPER",
      suggestedScope: { paperMode: "RELAXED_PAPER" },
      confidence: 65,
    });
  }

  for (const ev of input.evaluations ?? []) {
    for (const hint of ev.improvementHints.slice(0, 2)) {
      addPattern(patterns, seen, {
        patternId: patternId("learning", ev.decisionLogId),
        category: "agent_weakness",
        condition: hint,
        rationale: `Self-learning evaluation on ${ev.marketRegime}.`,
        supportingTradeIds: [ev.decisionLogId],
        winRate: ev.tradeWouldWin ? 100 : 0,
        avgPnlPct: ev.pnlPct,
        sampleSize: 1,
        suggestedRuleType: "CAUTION",
        suggestedScope: { regime: ev.marketRegime },
        confidence: 55,
      });
    }
  }

  for (const edge of (input.memoryGraph?.edges ?? []).filter(
    (e) =>
      e.relation === "condition_increased_drawdown" ||
      e.relation === "performs_poorly_in",
  ).slice(0, 5)) {
    addPattern(patterns, seen, {
      patternId: patternId("memory", edge.id),
      category: "memory_lesson",
      condition: edge.evidence,
      rationale: `Memory graph edge: ${edge.relation}.`,
      supportingTradeIds: [],
      winRate: 0,
      avgPnlPct: -edge.weight,
      sampleSize: 2,
      suggestedRuleType: "CAUTION",
      suggestedScope: {},
      confidence: 60,
    });
  }

  for (const skill of input.registryStrategies ?? []) {
    if (skill.sampleSize >= 3 && skill.winRate < 40 && skill.avgR < 0) {
      addPattern(patterns, seen, {
        patternId: patternId("strategy", skill.id),
        category: "strategy_underperform",
        condition: `SIZE_REDUCE or BLOCK ${skill.name} until paper improves`,
        rationale: `Registry win ${skill.winRate}% · avg R ${skill.avgR}.`,
        supportingTradeIds: [],
        winRate: skill.winRate,
        avgPnlPct: skill.avgR,
        sampleSize: skill.sampleSize,
        suggestedRuleType: "SIZE_REDUCE",
        suggestedScope: { strategyId: skill.id as StrategyId },
        confidence: 70,
      });
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}
