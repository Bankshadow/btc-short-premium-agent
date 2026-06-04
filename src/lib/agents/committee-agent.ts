import type {
  AgentDebateRow,
  AgentOutput,
  AgentRecommendation,
  CommitteeVerdict,
} from "@/lib/types/agent";
import { collectTopReasons } from "@/lib/decision/verdict-display";
import {
  buildAgentOutput,
  majorityRecommendation,
  resolveMixedView,
  type TradingDeskContext,
} from "./shared";

export interface CommitteeInput {
  ctx: TradingDeskContext;
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
  const { ctx, marketData, spot, futures, options, riskManager } = input;
  const strategyAgents = [spot, futures, options];
  const strategyRecs = strategyAgents.map((a) => a.recommendation);
  const majority = majorityRecommendation(strategyRecs);
  const riskVetoApplied = Boolean(riskManager.veto);

  let finalRec: AgentRecommendation = majority;
  const dissent: string[] = [];

  for (const agent of strategyAgents) {
    if (agent.recommendation !== majority) {
      dissent.push(
        `${agent.agentName}: ${agent.recommendation} (${agent.reasons[0] ?? "no detail"})`,
      );
    }
  }

  if (riskVetoApplied) {
    finalRec = "SKIP";
  } else if (marketData.recommendation === "SKIP") {
    finalRec = "SKIP";
  } else if (
    majority === "TRADE" &&
    options.recommendation !== "TRADE"
  ) {
    finalRec = options.recommendation === "SKIP" ? "SKIP" : "WAIT";
    dissent.push("Options desk does not confirm TRADE — committee defers.");
  } else if (majority === "TRADE" && futures.recommendation === "SKIP") {
    finalRec = "WAIT";
    dissent.push("Futures desk SKIP — committee waits for perp alignment.");
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
  if (dissent.length > 0 && topReasons.length < 3) {
    topReasons.push(dissent[0]);
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
    summary = "Risk Manager veto — final desk verdict SKIP.";
  } else if (finalRec === "TRADE") {
    summary = "Committee consensus TRADE — hypothetical plan only (no execution).";
  } else if (finalRec === "WAIT") {
    summary = "Mixed agent views or missing data — WAIT for alignment.";
  } else {
    summary = "Committee SKIP — no hypothetical orders.";
  }

  const actionPlan =
    finalRec === "TRADE"
      ? ctx.response.step6_actionPlan.entryNotes
      : finalRec === "SKIP"
        ? ctx.response.step6_actionPlan.entryNotes ||
          "No order. Risk or playbook blocks trade."
        : "Monitor agents; refresh data and re-run committee.";

  const verdict: CommitteeVerdict = {
    recommendation: finalRec,
    confidence,
    summary,
    topReasons: trimmedReasons,
    actionPlan,
    agreement: resolveAgreement(strategyRecs),
    riskVetoApplied,
    dissent: dissent.slice(0, 4),
  };

  const debate = buildDebateRows(
    [marketData, spot, futures, options, riskManager],
    majority,
  );

  const agent = buildAgentOutput({
    agentName: "Debate / Committee Agent",
    strategyType: "committee",
    marketView: resolveMixedView(strategyAgents.map((a) => a.marketView)),
    recommendation: finalRec,
    confidence,
    reasons: [
      `Strategy majority: ${majority} (${strategyRecs.join(", ")}).`,
      `Agreement: ${verdict.agreement}.`,
      ...trimmedReasons,
    ],
    risks: [
      ...(riskVetoApplied ? ["Risk veto binding."] : []),
      "Committee output is advisory — human executes manually if ever.",
    ],
    proposedAction: {
      instrument: "desk verdict",
      side: "none",
      sizePct:
        finalRec === "TRADE"
          ? ctx.response.step6_actionPlan.suggestedSizePct
          : 0,
      notes: actionPlan,
    },
  });

  return { agent, verdict, debate };
}
