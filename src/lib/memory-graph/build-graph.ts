import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { DraftRule } from "@/lib/journal/draft-rules";
import type { DeskIncident } from "@/lib/governance/governance-types";
import type { CouncilSessionResult } from "@/lib/council/types";
import type { StrategyAdaptationProposal } from "@/lib/strategy-adaptation/types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type {
  MemoryEdge,
  MemoryGraphBuildInput,
  MemoryGraphSnapshot,
  MemoryNode,
  RegimeMemoryNode,
} from "./types";

export const MEMORY_GRAPH_SAFETY_NOTICE =
  "Memory graph is advisory only — cannot place trades or bypass governance or risk veto.";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function regimeKey(regime: string): string {
  return `regime:${slug(regime || "unknown")}`;
}

function strategyKey(id: string): string {
  return `strategy:${slug(id)}`;
}

function agentKey(name: string): string {
  return `agent:${slug(name)}`;
}

function outcomeKey(kind: string): string {
  return `outcome:${slug(kind)}`;
}

function conditionKey(kind: string): string {
  return `condition:${slug(kind)}`;
}

export function buildMemoryGraph(
  input: MemoryGraphBuildInput,
): MemoryGraphSnapshot {
  const nodes = new Map<string, MemoryNode>();
  const edges: MemoryEdge[] = [];
  const now = new Date().toISOString();

  function addNode(node: MemoryNode) {
    const existing = nodes.get(node.id);
    if (!existing || node.weight > existing.weight) {
      nodes.set(node.id, node);
    }
  }

  function addEdge(
    from: string,
    to: string,
    relation: MemoryEdge["relation"],
    evidence: string,
    weight = 1,
  ) {
    edges.push({
      id: `edge-${from}-${to}-${relation}-${edges.length}`,
      from,
      to,
      relation,
      weight,
      evidence,
      createdAt: now,
    });
  }

  const entries = input.entries ?? [];
  const resolved = entries.filter((e) => e.outcomeStatus === "RESOLVED");

  const regimeStats = new Map<
    string,
    { wins: number; losses: number; pnl: number; n: number }
  >();

  for (const entry of resolved) {
    const rk = regimeKey(entry.marketRegime);
    const stat = regimeStats.get(rk) ?? { wins: 0, losses: 0, pnl: 0, n: 0 };
    stat.n += 1;
    const pnl = entry.paperPnl ?? 0;
    stat.pnl += pnl;
    if (pnl > 0) stat.wins += 1;
    else if (pnl < 0) stat.losses += 1;
    regimeStats.set(rk, stat);

    const regimeNode: RegimeMemoryNode = {
      id: rk,
      type: "regime",
      label: entry.marketRegime,
      summary: `Regime ${entry.marketRegime} — ${stat.n} resolved sessions.`,
      weight: stat.n,
      sourceIds: [entry.id],
      tags: [entry.marketRegime],
      createdAt: entry.timestamp,
      regimeKey: rk,
      sampleSize: stat.n,
      winRate: stat.n > 0 ? Math.round((stat.wins / stat.n) * 100) : 0,
    };
    addNode(regimeNode);

    const strategyIds = strategiesSignaledOnEntry(entry);
    for (const sid of strategyIds) {
      const sk = strategyKey(sid);
      addNode({
        id: sk,
        type: "strategy",
        label: STRATEGY_LABELS[sid] ?? sid,
        summary: `Strategy ${STRATEGY_LABELS[sid] ?? sid} signaled on ${entry.id}.`,
        weight: 1,
        sourceIds: [entry.id],
        tags: [sid, entry.marketRegime],
        createdAt: entry.timestamp,
        strategyKey: sk,
      });
      addEdge(sk, rk, pnl >= 0 ? "performs_well_in" : "performs_poorly_in", `PnL ${pnl}% in ${entry.marketRegime}`, Math.abs(pnl) + 1);
    }

    const outcomeKind =
      pnl > 1 ? "large_win" : pnl < -1 ? "large_loss" : pnl < 0 ? "small_loss" : "small_win";
    const ok = outcomeKey(outcomeKind);
    addNode({
      id: ok,
      type: "outcome",
      label: outcomeKind.replace(/_/g, " "),
      summary: `Outcome ${outcomeKind} (${pnl}% PnL).`,
      weight: Math.abs(pnl),
      sourceIds: [entry.id],
      tags: [outcomeKind],
      createdAt: entry.timestamp,
    });
    addNode({
      id: `trade_outcome:${entry.id}`,
      type: "trade_outcome",
      label: `Trade ${entry.id.slice(0, 8)}`,
      summary: `Resolved ${pnl}% · verdict ${entry.finalVerdict}`,
      weight: Math.abs(pnl),
      sourceIds: [entry.id],
      tags: [entry.finalVerdict, entry.marketRegime],
      createdAt: entry.timestamp,
      outcome: pnl > 0 ? "win" : pnl < 0 ? "loss" : "neutral",
      pnlPct: pnl,
      decisionLogId: entry.id,
    } as MemoryNode);
    addEdge(`trade_outcome:${entry.id}`, rk, "linked_to_decision", entry.actionPlan.slice(0, 120), 1);

    if (entry.reflection) {
      for (const agent of entry.reflection.tooAggressiveAgents) {
        const ak = agentKey(agent);
        addNode({
          id: ak,
          type: "agent",
          label: agent,
          summary: `Reflection flagged ${agent} as too aggressive.`,
          weight: 2,
          sourceIds: [entry.id],
          tags: ["aggression"],
          createdAt: entry.reflection.generatedAt,
          agentName: agent,
        } as MemoryNode);
        addEdge(ak, ok, "agent_wrong_under", entry.reflection.whatWasWrong[0] ?? "Too aggressive", 2);
      }
      for (const rule of entry.reflection.helpfulRiskRules) {
        const rk2 = `rule:reflection:${slug(rule)}`;
        addNode({
          id: rk2,
          type: "rule",
          label: rule.slice(0, 40),
          summary: rule,
          weight: 2,
          sourceIds: [entry.id],
          tags: ["reflection"],
          createdAt: entry.reflection.generatedAt,
          ruleId: rk2,
          status: "reflection",
        } as MemoryNode);
        if (pnl >= 0) {
          addEdge(rk2, ok, "rule_prevented_loss", rule, 2);
        }
      }
    }

    if (entry.preMortem?.preMortemVerdict === "BLOCK") {
      const ck = conditionKey("pre_mortem_block");
      addNode({
        id: ck,
        type: "condition",
        label: "pre-mortem block",
        summary: entry.preMortem.topFailureReason,
        weight: 3,
        sourceIds: [entry.id],
        tags: ["pre_mortem"],
        createdAt: entry.preMortem.generatedAt,
      });
    }

    for (const agent of entry.agentOutputs) {
      const ak = agentKey(agent.agentName);
      addNode({
        id: ak,
        type: "agent",
        label: agent.agentName,
        summary: `${agent.recommendation} on ${entry.id.slice(0, 8)}`,
        weight: 1,
        sourceIds: [entry.id],
        tags: [agent.recommendation],
        createdAt: entry.timestamp,
        agentName: agent.agentName,
      } as MemoryNode);
      const win =
        entry.resolution?.tradeWouldWin === true ||
        (entry.paperPnl != null && entry.paperPnl > 0);
      const aligned =
        (agent.recommendation === "TRADE" && win) ||
        (agent.recommendation === "SKIP" && !win);
      addEdge(
        ak,
        ok,
        aligned ? "agent_accurate_under" : "agent_wrong_under",
        `${agent.recommendation} vs outcome`,
        aligned ? 1 : 2,
      );
    }
  }

  const scoreboard = buildAgentScoreboard(entries);
  for (const row of scoreboard.agents) {
    if (row.totalCalls < 2) continue;
    const ak = agentKey(row.agentName);
    addNode({
      id: ak,
      type: "agent",
      label: row.agentName,
      summary: `Scoreboard: ${row.falsePositives} FP / ${row.falseNegatives} FN`,
      weight: row.falsePositives + row.falseNegatives + 1,
      sourceIds: [],
      tags: ["scoreboard"],
      createdAt: now,
      agentName: row.agentName,
      falsePositives: row.falsePositives,
      falseNegatives: row.falseNegatives,
    } as MemoryNode);
  }

  for (const rule of input.draftRules ?? []) {
    const rk = `rule:${rule.id}`;
    addNode({
      id: rk,
      type: "rule",
      label: rule.title,
      summary: rule.description,
      weight: rule.status === "approved" ? 3 : 1,
      sourceIds: [rule.sourceEntryId],
      tags: [rule.status],
      createdAt: rule.createdAt,
      ruleId: rule.id,
      status: rule.status,
    } as MemoryNode);
    if (rule.sourceEntryId) {
      addEdge(rk, `trade_outcome:${rule.sourceEntryId}`, "reflection_supports", rule.description, 2);
    }
  }

  for (const note of input.pinnedNotes ?? []) {
    if (!note.trim()) continue;
    addNode({
      id: `rule:pinned:${slug(note)}`,
      type: "rule",
      label: "Pinned note",
      summary: note,
      weight: 4,
      sourceIds: [],
      tags: ["pinned"],
      createdAt: now,
      ruleId: `pinned-${slug(note)}`,
      status: "pinned",
    } as MemoryNode);
  }

  for (const inc of input.incidents ?? []) {
    const ik = `risk_event:${inc.id}`;
    addNode({
      id: ik,
      type: "risk_event",
      label: inc.type,
      summary: inc.description,
      weight: inc.severity === "critical" ? 5 : 3,
      sourceIds: inc.affectedDecisionId ? [inc.affectedDecisionId] : [],
      tags: [inc.severity, inc.status],
      createdAt: inc.createdAt,
      severity: inc.severity,
      incidentType: inc.type,
    } as MemoryNode);
    if (inc.affectedDecisionId) {
      addEdge(ik, `trade_outcome:${inc.affectedDecisionId}`, "incident_caused_by", inc.rootCause, 3);
    }
  }

  for (const session of input.councilSessions ?? []) {
    for (const proposal of session.proposals) {
      const pk = `proposal:council:${proposal.id}`;
      addNode({
        id: pk,
        type: "proposal",
        label: proposal.title,
        summary: proposal.proposedChange,
        weight: 2,
        sourceIds: [session.councilSessionId],
        tags: [proposal.status, proposal.targetStrategy],
        createdAt: session.timestamp,
      });
      if (proposal.targetStrategy !== "desk" && proposal.targetStrategy !== "multi") {
        addEdge(pk, strategyKey(proposal.targetStrategy), "proposal_changed_strategy", proposal.problemObserved, 2);
      }
    }
  }

  for (const prop of input.adaptationProposals ?? []) {
    if (prop.status !== "APPLIED" && prop.status !== "APPROVED") continue;
    const pk = `proposal:adapt:${prop.proposalId}`;
    addNode({
      id: pk,
      type: "proposal",
      label: `${prop.type} ${prop.targetStrategy}`,
      summary: prop.reason,
      weight: 3,
      sourceIds: [prop.proposalId],
      tags: [prop.type, prop.targetStrategy],
      createdAt: prop.createdAt,
    });
    addEdge(pk, strategyKey(prop.targetStrategy), "proposal_changed_strategy", prop.reason, 3);
  }

  for (const skill of input.registryStrategies ?? []) {
    const sk = strategyKey(skill.id);
    addNode({
      id: sk,
      type: "strategy",
      label: skill.name,
      summary: `Registry ${skill.status} · win ${skill.winRate}% · n=${skill.sampleSize}`,
      weight: skill.performanceScore,
      sourceIds: [],
      tags: [skill.status, ...skill.allowedRegimes],
      createdAt: skill.lastUsed ?? now,
      strategyKey: sk,
      winRate: skill.winRate,
      avgPnl: skill.avgR,
    } as MemoryNode);
    for (const hist of skill.versionHistory.slice(0, 3)) {
      addEdge(sk, strategyKey(skill.id), "proposal_changed_strategy", hist.note, 1);
    }
  }

  for (const entry of resolved) {
    if ((entry.paperPnl ?? 0) < -2) {
      const ck = conditionKey("drawdown_pressure");
      addEdge(ck, regimeKey(entry.marketRegime), "condition_increased_drawdown", `Loss ${entry.paperPnl}%`, 2);
    }
    if (entry.marketRegime.toLowerCase().includes("macro")) {
      const ck = conditionKey("macro_event_week");
      addNode({
        id: ck,
        type: "condition",
        label: "macro event week",
        summary: "Macro caution regime session",
        weight: 2,
        sourceIds: [entry.id],
        tags: ["macro"],
        createdAt: entry.timestamp,
      });
    }
    if (entry.marketRegime.toLowerCase().includes("liquidation")) {
      const ck = conditionKey("liquidation_cluster");
      addNode({
        id: ck,
        type: "condition",
        label: "liquidation cluster",
        summary: "Liquidation stress regime",
        weight: 3,
        sourceIds: [entry.id],
        tags: ["liquidation"],
        createdAt: entry.timestamp,
      });
      addEdge(ck, outcomeKey("large_loss"), "condition_increased_drawdown", "Liquidation regime loss", 2);
    }
  }

  const nodeList = [...nodes.values()];
  const topLessons = edges
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map((e) => e.evidence);

  return {
    generatedAt: now,
    nodeCount: nodeList.length,
    edgeCount: edges.length,
    nodes: nodeList,
    edges,
    topLessons,
    safetyNotice: MEMORY_GRAPH_SAFETY_NOTICE,
  };
}
