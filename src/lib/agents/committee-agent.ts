import type {
  AgentDebateRow,
  AgentOutput,
  AgentRecommendation,
  CommitteeVerdict,
  MarketRegimeSnapshot,
} from "./types";
import { collectTopReasons } from "@/lib/decision/verdict-display";
import {
  buildAgentOutput,
  majorityRecommendation,
  resolveMixedView,
  type TradingDeskContext,
} from "./shared";

export interface CommitteeInput {
  ctx: TradingDeskContext;
  regime: MarketRegimeSnapshot;
  marketData: AgentOutput;
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  riskManager: AgentOutput;
}

function buildDebateRows(
  agents: AgentOutput[],
  majority: AgentRecommendation,
): AgentDebateRow[] {
  return agents.map((agent) => ({
    agentName: agent.agentName,
    strategyType: agent.strategyType,
    recommendation: agent.recommendation,
    confidence: agent.confidence,
    marketView: agent.marketView,
    alignedWithMajority: agent.recommendation === majority,
  }));
}

function resolveAgreement(
  strategyRecs: AgentRecommendation[],
): CommitteeVerdict["agreement"] {
  const unique = new Set(strategyRecs);
  if (unique.size === 1) return "strong";
  if (unique.size === 2) return "mixed";
  return "split";
}

export function runCommitteeAgent(input: CommitteeInput): {
  agent: AgentOutput;
  verdict: CommitteeVerdict;
  debate: AgentDebateRow[];
} {
  const { ctx, regime, marketData, spot, futures, options, riskManager } =
    input;
  const strategyAgents = [spot, futures, options];
  const strategyRecs = strategyAgents.map((a) => a.recommendation);
  const majority = majorityRecommendation(strategyRecs);
  const riskVetoApplied = Boolean(riskManager.veto);

  const agreementNotes: string[] = [];
  const disagreementNotes: string[] = [];

  for (const agent of strategyAgents) {
    if (agent.recommendation === majority) {
      agreementNotes.push(
        `${agent.agentName} agrees (${agent.recommendation}, ${agent.confidence}%).`,
      );
    } else {
      disagreementNotes.push(
        `${agent.agentName} disagrees: ${agent.recommendation} — ${agent.reasons[0] ?? ""}`,
      );
    }
  }

  if (regime.agent.recommendation === "SKIP") {
    disagreementNotes.push(
      `Regime ${regime.title} — ${regime.agent.recommendation}.`,
    );
  }

  let finalRec: AgentRecommendation = majority;
  const dissent: string[] = [...disagreementNotes];

  if (riskVetoApplied) {
    finalRec = "SKIP";
  } else if (marketData.missingData.length > 0) {
    finalRec = "WAIT";
    dissent.push("Market data incomplete — committee waits.");
  } else if (regime.agent.recommendation === "SKIP") {
    finalRec = "SKIP";
  } else if (majority === "TRADE" && options.recommendation !== "TRADE") {
    finalRec = options.recommendation === "SKIP" ? "SKIP" : "WAIT";
    dissent.push("Options desk does not confirm TRADE.");
  } else if (majority === "TRADE" && futures.recommendation === "SKIP") {
    finalRec = "WAIT";
    dissent.push("Futures desk SKIP — wait for perp alignment.");
  }

  const playbookReasons = collectTopReasons(
    ctx.response.step5_verdict,
    ctx.response.step2_eightCheckFramework,
    ctx.response.step3_noTradeRules,
    ctx.response.step4_combinationRead,
  );

  const topReasons: string[] = [];
  if (riskVetoApplied && riskManager.vetoReasons?.length) {
    topReasons.push(...riskManager.vetoReasons.slice(0, 2));
  }
  topReasons.push(...playbookReasons);
  if (disagreementNotes.length > 0 && topReasons.length < 3) {
    topReasons.push(disagreementNotes[0]);
  }
  const trimmedReasons = [...new Set(topReasons)].slice(0, 3);

  const confidence = riskVetoApplied
    ? 100
    : Math.round(
        strategyAgents.reduce((sum, a) => sum + a.confidence, 0) /
          strategyAgents.length,
      );

  let summary: string;
  if (riskVetoApplied) {
    summary = "Risk Manager veto — final verdict SKIP. Human review required.";
  } else if (finalRec === "TRADE") {
    summary =
      "Committee TRADE — hypothetical plan only; human must approve before any action.";
  } else if (finalRec === "WAIT") {
    summary = "Committee WAIT — agents or data not aligned.";
  } else {
    summary = "Committee SKIP — no hypothetical orders.";
  }

  const actionSummary =
    finalRec === "TRADE"
      ? ctx.response.step6_actionPlan.entryNotes
      : finalRec === "SKIP"
        ? ctx.response.step6_actionPlan.entryNotes ||
          "No order. Risk veto or playbook block."
        : "Refresh data, resolve missing fields, re-run committee.";

  const verdict: CommitteeVerdict = {
    recommendation: finalRec,
    confidence,
    summary,
    topReasons: trimmedReasons,
    actionSummary,
    actionPlan: actionSummary,
    agreement: resolveAgreement(strategyRecs),
    agreementNotes,
    disagreementNotes,
    riskVetoApplied,
    dissent: dissent.slice(0, 5),
  };

  const debate = buildDebateRows(
    [marketData, regime.agent, spot, futures, options, riskManager],
    majority,
  );

  const agent = buildAgentOutput(
    {
      agentName: "Committee Agent",
      strategyType: "COMMITTEE",
      marketView: resolveMixedView(strategyAgents.map((a) => a.marketView)),
      recommendation: finalRec,
      confidence,
      reasons: [
        `Strategy majority: ${majority}.`,
        `Agreement level: ${verdict.agreement}.`,
        ...agreementNotes.slice(0, 2),
      ],
      risks: [
        ...(riskVetoApplied ? ["Risk veto binding on all desks."] : []),
        "Advisory output — not an order.",
      ],
      proposedAction: {
        instrument: "desk verdict",
        side: "none",
        sizePct:
          finalRec === "TRADE"
            ? Math.min(1, ctx.response.step6_actionPlan.suggestedSizePct)
            : 0,
        notes: actionSummary,
      },
    },
    ctx,
  );

  return { agent, verdict, debate };
}
