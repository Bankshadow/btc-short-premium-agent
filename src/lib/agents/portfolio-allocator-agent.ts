import type {
  AgentOutput,
  PortfolioAllocation,
  PortfolioStage,
} from "@/lib/types/agent";
import type { AgentRecommendation } from "@/lib/types/agent";
import {
  buildAgentOutput,
  MAX_DAILY_LOSS_PCT,
  MAX_LOSS_PER_TRADE_PCT,
  PORTFOLIO_GOAL_USD,
  PORTFOLIO_STAGES_USD,
  type TradingDeskContext,
} from "./shared";

function resolveStages(capital: number): {
  current: PortfolioStage;
  next: PortfolioStage | null;
  progressPct: number;
} {
  const stages: PortfolioStage[] = PORTFOLIO_STAGES_USD.map((targetUsd, i) => ({
    label: `Stage ${i + 1}`,
    targetUsd,
    reached: capital >= targetUsd,
  }));

  let current = stages[0];
  for (const stage of stages) {
    if (capital >= stage.targetUsd) current = stage;
  }

  const next =
    stages.find((s) => !s.reached && s.targetUsd > capital) ?? null;

  const progressPct = Math.min(
    100,
    Math.round((capital / PORTFOLIO_GOAL_USD) * 100),
  );

  return { current, next, progressPct };
}

export function buildPortfolioAllocation(
  capitalUsd: number,
  committeeRec: AgentRecommendation,
): PortfolioAllocation {
  const { current, next, progressPct } = resolveStages(capitalUsd);
  const justDoubled =
    current.targetUsd >= 2000 &&
    capitalUsd >= current.targetUsd &&
    capitalUsd < (next?.targetUsd ?? PORTFOLIO_GOAL_USD + 1);

  const proposeSplit = justDoubled || capitalUsd >= current.targetUsd * 2 - 1;

  const notes: string[] = [
    `Goal path: ${PORTFOLIO_STAGES_USD.map((s) => `$${s}`).join(" → ")}+.`,
    `Desk mode: analysis-only at $${capitalUsd.toLocaleString()} equity.`,
  ];

  if (committeeRec === "SKIP") {
    notes.push("Committee SKIP — allocator holds fire, no new risk budget.");
  } else if (committeeRec === "WAIT") {
    notes.push("Committee WAIT — keep powder dry until data and agents align.");
  } else {
    notes.push(
      `If TRADE confirmed manually, risk per trade ≤ ${MAX_LOSS_PER_TRADE_PCT}%, daily ≤ ${MAX_DAILY_LOSS_PCT}%.`,
    );
  }

  return {
    initialCapitalUsd: PORTFOLIO_STAGES_USD[0],
    currentCapitalUsd: capitalUsd,
    goalCapitalUsd: PORTFOLIO_GOAL_USD,
    currentStage: current,
    nextStage: next,
    progressPct,
    proposeSplit: proposeSplit && capitalUsd >= 2000,
    split: proposeSplit && capitalUsd >= 2000
      ? {
          reservePct: 40,
          growthPct: 50,
          experimentalPct: 10,
          rationale:
            "Capital doubled past stage gate — lock 40% reserve, 50% growth book, 10% experimental ideas (still analysis-only).",
        }
      : null,
    maxLossPerTradePct: MAX_LOSS_PER_TRADE_PCT,
    maxDailyLossPct: MAX_DAILY_LOSS_PCT,
    notes,
  };
}

export function runPortfolioAllocatorAgent(
  ctx: TradingDeskContext,
  committeeRec: AgentRecommendation,
): { agent: AgentOutput; allocation: PortfolioAllocation } {
  const allocation = buildPortfolioAllocation(
    ctx.portfolioCapitalUsd,
    committeeRec,
  );

  const agent = buildAgentOutput({
    agentName: "Portfolio Allocator Agent",
    strategyType: "portfolio",
    marketView: "neutral",
    recommendation:
      committeeRec === "TRADE" ? "TRADE" : committeeRec === "SKIP" ? "SKIP" : "WAIT",
    confidence: 75,
    reasons: [
      `Progress to $${PORTFOLIO_GOAL_USD.toLocaleString()} goal: ${allocation.progressPct}%.`,
      `Current stage: ${allocation.currentStage.label} ($${allocation.currentStage.targetUsd}).`,
      ...(allocation.split
        ? [
            `Proposed split: ${allocation.split.reservePct}% reserve / ${allocation.split.growthPct}% growth / ${allocation.split.experimentalPct}% experimental.`,
          ]
        : ["No capital split proposed until next doubling milestone."]),
    ],
    risks: [
      "Staged growth is a planning model — not a guarantee.",
      "Experimental sleeve must stay small vs reserve.",
    ],
    proposedAction: {
      instrument: "portfolio buckets",
      side: "neutral",
      sizePct: allocation.split?.growthPct ?? 0,
      notes: allocation.notes.join(" "),
    },
  });

  return { agent, allocation };
}
