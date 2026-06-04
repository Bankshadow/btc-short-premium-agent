import type { AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { DraftRule } from "@/lib/journal/draft-rules";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import type { DeskMemoryBuckets, DeskMemoryClientPayload } from "./types";

const MAX_LOGS_FOR_MEMORY = 30;

export function buildClientMemoryPayload(
  logs: DecisionLogEntry[],
  rules: DraftRule[],
  pinnedNotes: string[],
): DeskMemoryClientPayload {
  return {
    pinnedNotes,
    recentLogs: logs.slice(0, MAX_LOGS_FOR_MEMORY),
    draftRules: rules,
  };
}

function buildRegimeHistory(
  logs: DecisionLogEntry[],
  currentRegime: string,
): string[] {
  const resolved = logs.filter((e) => e.outcomeStatus === "RESOLVED");
  const sameRegime = resolved
    .filter((e) => e.marketRegime === currentRegime)
    .slice(0, 5);

  const hints: string[] = [];
  if (sameRegime.length > 0) {
    const wins = sameRegime.filter((e) => (e.paperPnl ?? 0) > 0).length;
    hints.push(
      `${currentRegime}: ${sameRegime.length} resolved in this regime (${wins} positive paper PnL).`,
    );
  }

  const regimeCounts = new Map<string, number>();
  for (const e of resolved) {
    regimeCounts.set(e.marketRegime, (regimeCounts.get(e.marketRegime) ?? 0) + 1);
  }
  const top = [...regimeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    hints.push(`Most frequent resolved regime: ${top[0]} (${top[1]} runs).`);
  }

  return hints;
}

function buildScoreboardHints(logs: DecisionLogEntry[]): string[] {
  const scoreboard = buildAgentScoreboard(logs);
  const hints: string[] = [];

  if (scoreboard.totalResolved === 0) {
    hints.push("No resolved outcomes yet — memory is limited until you resolve logs.");
    return hints;
  }

  hints.push(
    `Resolved ${scoreboard.totalResolved} runs · net paper ${scoreboard.netPaperPnlPct >= 0 ? "+" : ""}${scoreboard.netPaperPnlPct}%.`,
  );

  if (scoreboard.riskVetoCount > 0) {
    hints.push(
      `Risk veto accuracy (paper): ${scoreboard.riskVetoAccuracyPct}% over ${scoreboard.riskVetoCount} vetoes.`,
    );
  }

  const worst = [...scoreboard.agents]
    .filter((a) => a.falsePositives + a.falseNegatives > 0)
    .sort(
      (a, b) =>
        b.falsePositives + b.falseNegatives - (a.falsePositives + a.falseNegatives),
    )[0];

  if (worst) {
    hints.push(
      `Watch ${worst.agentName}: ${worst.falsePositives} false + / ${worst.falseNegatives} false −.`,
    );
  }

  const best = [...scoreboard.agents].sort(
    (a, b) =>
      b.correctTradeCalls + b.correctSkips - (a.correctTradeCalls + a.correctSkips),
  )[0];

  if (best && best.totalCalls >= 2) {
    hints.push(
      `Strongest paper alignment: ${best.agentName} (${best.correctTradeCalls} trade / ${best.correctSkips} skip hits).`,
    );
  }

  return hints;
}

function buildReflectionLearnings(logs: DecisionLogEntry[]): string[] {
  const learnings: string[] = [];
  const resolved = logs.filter((e) => e.reflection);

  for (const entry of resolved.slice(0, 5)) {
    const r = entry.reflection!;
    for (const rule of r.helpfulRiskRules.slice(0, 1)) {
      learnings.push(`Risk lesson: ${rule}`);
    }
    for (const agent of r.tooAggressiveAgents.slice(0, 1)) {
      learnings.push(`Aggression flag: ${agent}`);
    }
  }

  return [...new Set(learnings)].slice(0, 5);
}

function buildApprovedHints(rules: DraftRule[]): string[] {
  return rules
    .filter((r) => r.status === "approved")
    .map((r) => `Approved playbook hint: ${r.description}`)
    .slice(0, 5);
}

export function buildDeskMemoryBuckets(
  payload: DeskMemoryClientPayload | undefined,
  currentRegime: string,
): DeskMemoryBuckets {
  const logs = payload?.recentLogs ?? [];
  const rules = payload?.draftRules ?? [];
  const pinned = (payload?.pinnedNotes ?? []).filter((n) => n.trim().length > 0);

  return {
    regimeHistory: buildRegimeHistory(logs, currentRegime),
    scoreboardHints: buildScoreboardHints(logs),
    approvedPlaybookHints: buildApprovedHints(rules),
    pinnedNotes: pinned.map((n) => `Pinned: ${n}`),
    reflectionLearnings: buildReflectionLearnings(logs),
  };
}

export function flattenMemoryBullets(buckets: DeskMemoryBuckets): string[] {
  const all = [
    ...buckets.pinnedNotes,
    ...buckets.approvedPlaybookHints,
    ...buckets.regimeHistory,
    ...buckets.scoreboardHints,
    ...buckets.reflectionLearnings,
  ];
  return [...new Set(all)].slice(0, 8);
}

export function recentVerdictBias(
  logs: DecisionLogEntry[],
): AgentRecommendation | null {
  const resolved = logs
    .filter((e) => e.outcomeStatus === "RESOLVED")
    .slice(0, 7);
  if (resolved.length < 2) return null;

  const skips = resolved.filter((e) => e.finalVerdict === "SKIP").length;
  if (skips >= Math.ceil(resolved.length * 0.6)) return "SKIP";
  const trades = resolved.filter((e) => e.finalVerdict === "TRADE").length;
  if (trades >= Math.ceil(resolved.length * 0.5)) return "TRADE";
  return "WAIT";
}

export function countLogs(payload: DeskMemoryClientPayload | undefined): {
  resolved: number;
  pending: number;
} {
  const logs = payload?.recentLogs ?? [];
  return {
    resolved: logs.filter((e) => e.outcomeStatus === "RESOLVED").length,
    pending: logs.filter((e) => e.outcomeStatus === "PENDING").length,
  };
}
