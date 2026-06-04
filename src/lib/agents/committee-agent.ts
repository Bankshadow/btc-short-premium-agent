import type {
  AgentDebateRow,
  AgentOutput,
  AgentRecommendation,
  CommitteeVerdict,
} from "./types";
import { collectTopReasons } from "@/lib/decision/verdict-display";
import type { DeskMemorySnapshot } from "@/lib/memory/types";
import type { ResearchBrief } from "@/lib/research/research-types";
import {
  committeeMinDataQualityScore,
  isAggressiveDeskRisk,
} from "@/lib/desk/desk-risk-policy";
import {
  majorityRecommendation,
  type TradingDeskContext,
} from "./shared";
import { tradeRecToAgent } from "./types";

export interface CommitteeInput {
  ctx: TradingDeskContext;
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  bull: AgentOutput;
  bear: AgentOutput;
  riskManager: AgentOutput;
  deskMemory: DeskMemorySnapshot;
  research: ResearchBrief;
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

export function runCommitteeAgent(input: CommitteeInput): {
  verdict: CommitteeVerdict;
  debate: AgentDebateRow[];
} {
  const { ctx, spot, futures, options, bull, bear, riskManager, deskMemory, research } =
    input;
  const strategyAgents = [spot, futures, options];
  const strategyRecs = strategyAgents.map((a) => a.recommendation);
  const majority = majorityRecommendation(strategyRecs);
  const riskVeto = Boolean(riskManager.veto);

  const agreementNotes: string[] = [];
  const disagreementNotes: string[] = [];

  for (const agent of [...strategyAgents, bull, bear]) {
    const line = `${agent.agentName}: ${agent.recommendation} (${agent.confidence}) — ${agent.reasons[0] ?? ""}`;
    if (agent.recommendation === majority || agent.strategyType === "THESIS") {
      if (agent.recommendation === majority) agreementNotes.push(line);
    } else {
      disagreementNotes.push(line);
    }
  }

  if (bull.recommendation === "TRADE" && bear.recommendation === "SKIP") {
    disagreementNotes.push("Bull vs Bear: bear thesis warns against risk.");
  }
  if (bull.recommendation === "TRADE" && bear.recommendation !== "SKIP") {
    agreementNotes.push("Bull thesis supported — bear not blocking.");
  }

  let finalVerdict: AgentRecommendation = majority;

  if (riskVeto) {
    finalVerdict = "SKIP";
  } else if (bear.recommendation === "SKIP" && bull.recommendation !== "TRADE") {
    finalVerdict = "SKIP";
  } else if (
    research.dataQuality.recommendation === "SKIP" &&
    research.dataQualityScore < committeeMinDataQualityScore()
  ) {
    finalVerdict = "WAIT";
    disagreementNotes.push(
      "Data Quality Agent: incomplete tape — committee waits.",
    );
  } else if (research.dataQualityScore < committeeMinDataQualityScore()) {
    finalVerdict = "WAIT";
  } else if (
    !isAggressiveDeskRisk() &&
    (options.missingData.length > 0 ||
      strategyAgents.some((a) => a.missingData.length > 0))
  ) {
    finalVerdict = "WAIT";
  } else if (
    !isAggressiveDeskRisk() &&
    majority === "TRADE" &&
    options.recommendation !== "TRADE"
  ) {
    finalVerdict = options.recommendation === "SKIP" ? "SKIP" : "WAIT";
  } else if (
    !isAggressiveDeskRisk() &&
    majority === "TRADE" &&
    bear.recommendation === "SKIP"
  ) {
    finalVerdict = "WAIT";
  }

  const playbookAgent = tradeRecToAgent(ctx.response.step5_verdict.recommendation);
  if (
    !riskVeto &&
    isAggressiveDeskRisk() &&
    playbookAgent === "TRADE" &&
    finalVerdict !== "TRADE"
  ) {
    finalVerdict = "TRADE";
    agreementNotes.push(
      "Aggressive desk: playbook engine TRADE — committee aligns for paper execution.",
    );
  } else if (
    !riskVeto &&
    isAggressiveDeskRisk() &&
    majority === "TRADE" &&
    finalVerdict === "WAIT"
  ) {
    finalVerdict = "TRADE";
    agreementNotes.push(
      "Strategy majority TRADE — aggressive desk approves with reduced size.",
    );
  }

  const playbookReasons = collectTopReasons(
    ctx.response.step5_verdict,
    ctx.response.step2_eightCheckFramework,
    ctx.response.step3_noTradeRules,
    ctx.response.step4_combinationRead,
  );

  const topReasons: string[] = [];
  if (research.summaryBullets.length > 0) {
    topReasons.push(`Research: ${research.summaryBullets[0]}`);
  }
  if (deskMemory.bullets.length > 0) {
    topReasons.push(`Desk memory: ${deskMemory.bullets[0]}`);
  }
  if (riskVeto && riskManager.vetoReasons?.length) {
    topReasons.push(...riskManager.vetoReasons.slice(0, 2));
  }
  topReasons.push(...playbookReasons);
  if (disagreementNotes.length > 0 && topReasons.length < 3) {
    topReasons.push(disagreementNotes[0]);
  }

  const trimmedReasons = [...new Set(topReasons)].slice(0, 3);

  let consensusSummary: string;
  if (riskVeto) {
    consensusSummary =
      "Risk Manager veto — desk cannot approve TRADE. Bull/Bear debate overridden.";
  } else if (finalVerdict === "TRADE") {
    consensusSummary = `Consensus leans TRADE (${majority} on strategies; bull/bear balanced enough). Human must approve.`;
  } else if (finalVerdict === "WAIT") {
    consensusSummary =
      "No consensus for TRADE — mixed agents or incomplete Bybit/CoinGlass data.";
  } else {
    consensusSummary =
      "Desk consensus SKIP — bear thesis, risk, or playbook blocks action.";
  }

  const finalActionPlan =
    finalVerdict === "TRADE"
      ? ctx.response.step6_actionPlan.entryNotes
      : finalVerdict === "SKIP"
        ? ctx.response.step6_actionPlan.entryNotes ||
          "No hypothetical orders — analysis only."
        : "Re-run after filling missing derivatives overrides.";

  const verdict: CommitteeVerdict = {
    finalVerdict,
    consensusSummary,
    riskVeto,
    topReasons: trimmedReasons,
    finalActionPlan,
    agreementNotes,
    disagreementNotes,
  };

  const debate = buildDebateRows(
    [bull, bear, spot, futures, options, riskManager],
    majority,
  );

  return { verdict, debate };
}
