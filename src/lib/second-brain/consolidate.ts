import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import type {
  ConsolidateSecondBrainResult,
  MemoryPolarity,
  SecondBrainMemory,
  SecondBrainMemoryType,
} from "./types";
import { resolveMemoryConflicts } from "./resolve-conflicts";
import { loadSecondBrainState, saveSecondBrainState, upsertMemoriesInState } from "./brain-store";

function newMemoryId(prefix: string): string {
  return `sb-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeMemory(
  partial: Omit<
    SecondBrainMemory,
    "memoryId" | "createdAt" | "updatedAt" | "consolidatedAt" | "superseded" | "supersededBy"
  > & {
    memoryId?: string;
  },
): SecondBrainMemory {
  const now = new Date().toISOString();
  return {
    ...partial,
    memoryId: partial.memoryId ?? newMemoryId(partial.type.toLowerCase()),
    superseded: false,
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
    consolidatedAt: now,
  };
}

function polarityFromResult(result: string | null | undefined): MemoryPolarity {
  if (result === "WIN") return "positive";
  if (result === "LOSS") return "negative";
  return "neutral";
}

function extractFromJournal(entries: DecisionLogEntry[]): SecondBrainMemory[] {
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const out: SecondBrainMemory[] = [];

  for (const entry of resolved.slice(0, 40)) {
    const pnl = entry.paperPnl ?? 0;
    const win = entry.resolution?.tradeWouldWin === true || pnl > 0;
    const lose = entry.resolution?.tradeWouldWin === false || pnl < 0;
    const type: SecondBrainMemoryType = win
      ? "StrategyPattern"
      : lose
        ? "RiskPattern"
        : "TradeLesson";
    const polarity: MemoryPolarity = win ? "positive" : lose ? "negative" : "neutral";
    const regime = entry.marketRegime ?? "unknown";
    out.push(
      makeMemory({
        type,
        title: `${entry.finalVerdict} in ${regime}`,
        lesson: win
          ? `Resolved ${entry.finalVerdict} worked in ${regime} — repeat setup with caution.`
          : lose
            ? `Resolved ${entry.finalVerdict} lost in ${regime} — tighten entry or skip similar.`
            : `Resolved ${entry.finalVerdict} in ${regime} — outcome inconclusive.`,
        polarity,
        confidence: Math.min(95, 40 + Math.abs(pnl) * 2),
        conflictKey: `journal:${entry.finalVerdict}:${regime}`,
        tags: [entry.finalVerdict, regime, type],
        sourceModule: "journal",
        linkedDecisionId: entry.id,
        linkedTradeId: null,
      }),
    );
  }

  return out;
}

function extractFromTestnetLearning(records: TestnetLearningRecord[]): SecondBrainMemory[] {
  return records
    .filter((r) => r.status === "LEARNED" && r.includeInLearning)
    .slice(0, 30)
    .map((r) =>
      makeMemory({
        type: "TradeLesson",
        title: `${r.symbol} ${r.result ?? "CLOSED"}`,
        lesson:
          r.reflectionNotes ??
          `Testnet ${r.symbol} closed ${r.result ?? "—"} · net ${r.netPnl?.toFixed(2) ?? "0"} USD.`,
        polarity: polarityFromResult(r.result),
        confidence: 55,
        conflictKey: `testnet:${r.symbol}:${r.strategy ?? "default"}`,
        tags: [r.symbol, r.result ?? "closed", "testnet"],
        sourceModule: "testnet-learning",
        linkedDecisionId: r.decisionLogId,
        linkedTradeId: r.closedTradeId,
      }),
    );
}

function extractFromEvaluations(
  evaluations: import("@/lib/self-learning/types").TradeEvaluationResult[],
): SecondBrainMemory[] {
  const out: SecondBrainMemory[] = [];
  for (const ev of evaluations.slice(0, 20)) {
    for (const agent of ev.agentEvaluations ?? []) {
      if (agent.prediction.falsePositives >= 2 || agent.prediction.falseNegatives >= 2) {
        out.push(
          makeMemory({
            type: "StrategyPattern",
            title: `${agent.agentName} weakness`,
            lesson: `${agent.agentName}: FP ${agent.prediction.falsePositives} · FN ${agent.prediction.falseNegatives} — discount in similar regimes.`,
            polarity: "negative",
            confidence: 50 + agent.prediction.falsePositives + agent.prediction.falseNegatives,
            conflictKey: `agent-weak:${agent.agentName}`,
            tags: [agent.agentName, "weakness"],
            sourceModule: "self-learning",
            linkedDecisionId: ev.decisionLogId,
            linkedTradeId: null,
          }),
        );
      }
      const bestRegime = [...(agent.byRegime ?? [])].sort(
        (a, b) => b.hitRate - a.hitRate,
      )[0];
      if (bestRegime && bestRegime.sampleSize >= 2 && bestRegime.hitRate >= 0.6) {
        out.push(
          makeMemory({
            type: "StrategyPattern",
            title: `${agent.agentName} fits ${bestRegime.label}`,
            lesson: `${agent.agentName} hit ${(bestRegime.hitRate * 100).toFixed(0)}% in ${bestRegime.label} (${bestRegime.sampleSize} samples).`,
            polarity: "positive",
            confidence: Math.round(bestRegime.hitRate * 100),
            conflictKey: `agent-fit:${agent.agentName}:${bestRegime.label}`,
            tags: [agent.agentName, bestRegime.label, "regime-fit"],
            sourceModule: "self-learning",
            linkedDecisionId: ev.decisionLogId,
            linkedTradeId: null,
          }),
        );
      }
    }
  }
  return out;
}

export async function consolidateSecondBrain(input: {
  entries?: DecisionLogEntry[];
  learningRecords?: TestnetLearningRecord[];
  loopBlockerReason?: string | null;
  projectDecisionTitle?: string | null;
  userPreferenceNote?: string | null;
  skillUpdateTitle?: string | null;
  force?: boolean;
}): Promise<ConsolidateSecondBrainResult> {
  const state = await loadSecondBrainState();
  const now = Date.now();
  const last = state.lastConsolidatedAt
    ? new Date(state.lastConsolidatedAt).getTime()
    : 0;
  if (!input.force && last > 0 && now - last < 23 * 60 * 60_000) {
    return {
      added: 0,
      updated: 0,
      conflictsResolved: 0,
      totalMemories: state.memories.filter((m) => !m.superseded).length,
      consolidatedAt: state.lastConsolidatedAt ?? new Date().toISOString(),
    };
  }

  const entries = input.entries ?? [];
  const incoming: SecondBrainMemory[] = [
    ...extractFromJournal(entries),
    ...extractFromTestnetLearning(input.learningRecords ?? []),
  ];

  try {
    const { loadServerEvaluationResults } = await import(
      "@/lib/self-learning/evaluation-server-store"
    );
    const evals = await loadServerEvaluationResults();
    incoming.push(...extractFromEvaluations(evals));
  } catch {
    // optional
  }

  if (input.loopBlockerReason) {
    incoming.push(
      makeMemory({
        type: "ExecutionIssue",
        title: "Autopilot loop blocked",
        lesson: input.loopBlockerReason,
        polarity: "negative",
        confidence: 70,
        conflictKey: "execution:loop-guard",
        tags: ["loop-guard", "execution"],
        sourceModule: "autopilot-loop-guard",
        linkedDecisionId: null,
        linkedTradeId: null,
      }),
    );
  }

  if (input.projectDecisionTitle) {
    incoming.push(
      makeMemory({
        type: "ProjectDecision",
        title: input.projectDecisionTitle,
        lesson: `Roadmap decision recorded: ${input.projectDecisionTitle}`,
        polarity: "neutral",
        confidence: 60,
        conflictKey: `project:${input.projectDecisionTitle.slice(0, 40)}`,
        tags: ["roadmap", "project"],
        sourceModule: "project-strategist",
        linkedDecisionId: null,
        linkedTradeId: null,
      }),
    );
  }

  if (input.userPreferenceNote) {
    incoming.push(
      makeMemory({
        type: "UserPreference",
        title: "Operator preference",
        lesson: input.userPreferenceNote,
        polarity: "neutral",
        confidence: 75,
        conflictKey: `pref:${input.userPreferenceNote.slice(0, 50)}`,
        tags: ["preference", "operator"],
        sourceModule: "mission-settings",
        linkedDecisionId: null,
        linkedTradeId: null,
      }),
    );
  }

  if (input.skillUpdateTitle) {
    incoming.push(
      makeMemory({
        type: "SkillUpdate",
        title: input.skillUpdateTitle,
        lesson: `Skill/principle adopted: ${input.skillUpdateTitle}`,
        polarity: "positive",
        confidence: 55,
        conflictKey: `skill:${input.skillUpdateTitle.slice(0, 40)}`,
        tags: ["skill", "strategist"],
        sourceModule: "project-strategist",
        linkedDecisionId: null,
        linkedTradeId: null,
      }),
    );
  }

  const beforeCount = state.memories.filter((m) => !m.superseded).length;
  let merged = upsertMemoriesInState(state, incoming);
  const { memories, resolvedCount } = resolveMemoryConflicts(merged.memories);
  merged = { ...merged, memories, conflictsResolved: state.conflictsResolved + resolvedCount };
  merged.lastConsolidatedAt = new Date().toISOString();
  merged.consolidationRuns += 1;
  await saveSecondBrainState(merged);

  const afterCount = merged.memories.filter((m) => !m.superseded).length;
  return {
    added: Math.max(0, afterCount - beforeCount),
    updated: incoming.length,
    conflictsResolved: resolvedCount,
    totalMemories: afterCount,
    consolidatedAt: merged.lastConsolidatedAt,
  };
}
