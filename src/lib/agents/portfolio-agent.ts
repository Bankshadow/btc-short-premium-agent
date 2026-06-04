import type {
  AgentOutput,
  AgentRecommendation,
  PortfolioMilestones,
  PortfolioStage,
} from "./types";
import {
  buildAgentOutput,
  MAX_DAILY_LOSS_PCT,
  MAX_RISK_PER_TRADE_PCT,
  MAX_WEEKLY_LOSS_PCT,
  PORTFOLIO_GOAL_USD,
  PORTFOLIO_MILESTONES_USD,
  type TradingDeskContext,
} from "./shared";

function resolveMilestones(capital: number): {
  current: PortfolioStage;
  next: PortfolioStage | null;
  progressPct: number;
  doubledAtStage: boolean;
} {
  const stages: PortfolioStage[] = PORTFOLIO_MILESTONES_USD.map(
    (targetUsd, i) => ({
      label: `$${targetUsd.toLocaleString()}`,
      targetUsd,
      reached: capital >= targetUsd,
    }),
  );

  let current = stages[0];
  let prevTarget: number = PORTFOLIO_MILESTONES_USD[0];
  for (let i = 0; i < stages.length; i++) {
    if (capital >= stages[i].targetUsd) {
      current = stages[i];
      prevTarget = PORTFOLIO_MILESTONES_USD[i];
    }
  }

  const next =
    stages.find((s) => !s.reached && s.targetUsd > capital) ?? null;

  const doubledAtStage =
    capital >= prevTarget * 2 && capital >= 2000;

  const progressPct = Math.min(
    100,
    Math.round((capital / PORTFOLIO_GOAL_USD) * 100),
  );

  return { current, next, progressPct, doubledAtStage };
}

export function buildPortfolioMilestones(
  capitalUsd: number,
  committeeRec: AgentRecommendation,
): PortfolioMilestones {
  const { current, next, progressPct, doubledAtStage } =
    resolveMilestones(capitalUsd);

  const proposeSplit = doubledAtStage;

  const notes: string[] = [
    `Milestones: ${PORTFOLIO_MILESTONES_USD.map((s) => `$${s}`).join(" → ")}+.`,
    `Analysis-only desk at $${capitalUsd.toLocaleString()} notional planning capital.`,
  ];

  if (committeeRec === "SKIP") {
    notes.push("Committee SKIP — no new risk budget.");
  } else if (committeeRec === "WAIT") {
    notes.push("Committee WAIT — preserve capital.");
  } else {
    notes.push(
      `Manual TRADE only with ≤${MAX_RISK_PER_TRADE_PCT}% / trade, ≤${MAX_DAILY_LOSS_PCT}% daily, ≤${MAX_WEEKLY_LOSS_PCT}% weekly policy.`,
    );
  }

  return {
    initialCapitalUsd: PORTFOLIO_MILESTONES_USD[0],
    currentCapitalUsd: capitalUsd,
    goalCapitalUsd: PORTFOLIO_GOAL_USD,
    milestonesUsd: PORTFOLIO_MILESTONES_USD,
    currentStage: current,
    nextStage: next,
    progressPct,
    doubledAtStage,
    proposeSplit,
    split: proposeSplit
      ? {
          reservePct: 40,
          growthPct: 50,
          experimentalPct: 10,
          rationale:
            "Capital doubled at milestone — 40% reserve, 50% growth, 10% experimental (still no auto trades).",
        }
      : null,
    maxRiskPerTradePct: MAX_RISK_PER_TRADE_PCT,
    maxDailyLossPct: MAX_DAILY_LOSS_PCT,
    maxWeeklyLossPct: MAX_WEEKLY_LOSS_PCT,
    notes,
  };
}

/** @deprecated */
export const buildPortfolioAllocation = buildPortfolioMilestones;

export function runPortfolioAgent(
  ctx: TradingDeskContext,
  committeeRec: AgentRecommendation,
): { agent: AgentOutput; milestones: PortfolioMilestones } {
  const milestones = buildPortfolioMilestones(
    ctx.portfolioCapitalUsd,
    committeeRec,
  );

  const agent = buildAgentOutput(
    {
      agentName: "Portfolio Agent",
      strategyType: "PORTFOLIO",
      marketView: "neutral",
      recommendation:
        committeeRec === "TRADE"
          ? "TRADE"
          : committeeRec === "SKIP"
            ? "SKIP"
            : "WAIT",
      confidence: 75,
      reasons: [
        `Goal $${PORTFOLIO_GOAL_USD.toLocaleString()} — ${milestones.progressPct}% path progress.`,
        `Stage ${milestones.currentStage.label} reached: ${milestones.currentStage.reached}.`,
        ...(milestones.split
          ? [
              `Split: ${milestones.split.reservePct}% reserve / ${milestones.split.growthPct}% growth / ${milestones.split.experimentalPct}% experimental.`,
            ]
          : ["Await next doubling for bucket split."]),
      ],
      risks: [
        "Milestones are planning targets, not promises.",
        "Experimental bucket capped at 10% when split triggers.",
      ],
      proposedAction: {
        instrument: "portfolio buckets",
        side: "neutral",
        sizePct: milestones.split?.growthPct ?? 0,
        notes: milestones.notes.join(" "),
      },
    },
    ctx,
  );

  return { agent, milestones };
}

/** @deprecated */
export const runPortfolioAllocatorAgent = runPortfolioAgent;
