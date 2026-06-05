import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  RiskBudgetInput,
  RiskBudgetResult,
  RiskBudgetTimelinePoint,
  StrategyRiskSlice,
  AssetRiskSlice,
} from "./types";
import { RISK_BUDGET_SAFETY_NOTICE } from "./types";

const GOVERNANCE_MAX_SIZE_PCT = {
  balanced: 2.5,
  aggressive: 2.5,
} as const;

function governanceMaxPct(profile: "balanced" | "aggressive"): number {
  return GOVERNANCE_MAX_SIZE_PCT[profile];
}

function lossStreakFromPortfolio(
  portfolio: RiskBudgetInput["portfolio"],
): number {
  let streak = 0;
  for (const trade of [...portfolio.closedTrades].reverse()) {
    if ((trade.realizedPnlPct ?? 0) < 0) streak += 1;
    else break;
  }
  return streak;
}

function buildTimeline(
  portfolio: RiskBudgetInput["portfolio"],
  maxBudgetPct: number,
): RiskBudgetTimelinePoint[] {
  const equity = portfolio.metrics.totalEquity;
  return portfolio.equityCurve.slice(-12).map((pt) => ({
    timestamp: pt.at,
    equityUsd: pt.equityUsd,
    openExposurePct: portfolio.metrics.openExposurePct,
    budgetUsedPct: Number(
      ((portfolio.metrics.openExposurePct / Math.max(maxBudgetPct, 0.1)) * 100).toFixed(1),
    ),
    drawdownPct: portfolio.metrics.maxDrawdownPct,
  }));
}

function buildStrategyAllocation(
  portfolio: RiskBudgetInput["portfolio"],
  remainingPct: number,
): StrategyRiskSlice[] {
  const slices: StrategyRiskSlice[] = [];
  const totalOpen = portfolio.metrics.openExposurePct || 1;

  for (const exp of portfolio.metrics.exposureByStrategy) {
    const sid = exp.key as StrategyId;
    const label = STRATEGY_LABELS[sid] ?? exp.key;
    const share = exp.pctOfBook / 100;
    slices.push({
      strategyId: sid,
      label,
      allocatedPct: Number(exp.pctOfBook.toFixed(2)),
      openExposurePct: Number(
        ((exp.notionalUsd / portfolio.metrics.totalEquity) * 100).toFixed(2),
      ),
      recommendedPct: Number((remainingPct * share).toFixed(2)),
    });
  }

  if (slices.length === 0) {
    slices.push({
      strategyId: "options_short_premium",
      label: STRATEGY_LABELS.options_short_premium,
      allocatedPct: 0,
      openExposurePct: 0,
      recommendedPct: Number(remainingPct.toFixed(2)),
    });
  }

  return slices;
}

function buildAssetAllocation(
  portfolio: RiskBudgetInput["portfolio"],
  remainingPct: number,
): AssetRiskSlice[] {
  const slices: AssetRiskSlice[] = [];
  for (const exp of portfolio.metrics.exposureByAsset) {
    const share = exp.pctOfBook / 100;
    slices.push({
      asset: exp.key,
      allocatedPct: Number(exp.pctOfBook.toFixed(2)),
      openExposurePct: Number(
        ((exp.notionalUsd / portfolio.metrics.totalEquity) * 100).toFixed(2),
      ),
      recommendedPct: Number((remainingPct * Math.max(share, 0.25)).toFixed(2)),
    });
  }
  if (slices.length === 0) {
    slices.push({
      asset: "BTCUSDT",
      allocatedPct: 0,
      openExposurePct: 0,
      recommendedPct: Number(remainingPct.toFixed(2)),
    });
  }
  return slices;
}

export function optimizeRiskBudget(input: RiskBudgetInput): RiskBudgetResult {
  const profile = input.deskRiskProfile ?? "balanced";
  const equity =
    input.currentEquity ??
    input.portfolio.metrics.totalEquity;
  const maxAllowed = governanceMaxPct(profile);
  const blockReasons: string[] = [];
  const reductions: string[] = [];

  let sizePct = Math.min(input.baseSizePct, maxAllowed);

  const dailyLimit = VALIDATION_THRESHOLDS.dailyLossLimitPct;
  const weeklyLimit = VALIDATION_THRESHOLDS.weeklyLossLimitPct;
  const dailyPnlPct =
    equity > 0
      ? (input.portfolio.metrics.dailyPnlUsd / equity) * 100
      : 0;
  const weeklyPnlPct =
    equity > 0
      ? (input.portfolio.metrics.weeklyPnlUsd / equity) * 100
      : 0;

  const dailyUsed = dailyPnlPct < 0 ? Math.abs(dailyPnlPct / dailyLimit) * 100 : 0;
  const weeklyUsed =
    weeklyPnlPct < 0 ? Math.abs(weeklyPnlPct / weeklyLimit) * 100 : 0;

  if (dailyPnlPct <= dailyLimit) {
    blockReasons.push(
      `Daily loss limit hit (${dailyPnlPct.toFixed(2)}% vs ${dailyLimit}% limit).`,
    );
  }
  if (weeklyPnlPct <= weeklyLimit) {
    blockReasons.push(
      `Weekly loss limit hit (${weeklyPnlPct.toFixed(2)}% vs ${weeklyLimit}% limit).`,
    );
  }

  if (input.killSwitch?.tradingPaused) {
    blockReasons.push(
      `Kill switch active: ${input.killSwitch.messages.join(" ")}`,
    );
  }

  if (input.governance?.hardRules?.locked) {
    blockReasons.push("Governance hard rules locked.");
  }
  if (input.governance?.safeMode) {
    blockReasons.push("Governance safe mode — new risk blocked.");
  }

  const lossStreak =
    input.recentLossStreak ?? lossStreakFromPortfolio(input.portfolio);
  if (lossStreak >= 2) {
    const factor = Math.max(0.4, 1 - lossStreak * 0.15);
    sizePct *= factor;
    reductions.push(`Loss streak ${lossStreak} — size ×${factor.toFixed(2)}`);
  }

  const drawdown = input.portfolio.metrics.maxDrawdownPct;
  if (drawdown >= VALIDATION_THRESHOLDS.maxDrawdownWatchPct) {
    const factor = drawdown >= VALIDATION_THRESHOLDS.maxDrawdownDisablePct ? 0.5 : 0.7;
    sizePct *= factor;
    reductions.push(`Drawdown ${drawdown.toFixed(1)}% — size ×${factor}`);
  }

  const trust = input.dataTrust?.grade;
  if (trust === "CRITICAL") {
    sizePct *= 0.25;
    reductions.push("Data trust CRITICAL — size ×0.25");
    blockReasons.push("Data trust CRITICAL — new trades discouraged.");
  } else if (trust === "LOW") {
    sizePct *= 0.5;
    reductions.push("Data trust LOW — size ×0.5");
  } else if (trust === "MEDIUM") {
    sizePct *= 0.75;
    reductions.push("Data trust MEDIUM — size ×0.75");
  }

  const conflict = input.agentConflictLevel ?? "NONE";
  if (conflict === "CRITICAL" || conflict === "HIGH") {
    sizePct *= 0.5;
    reductions.push(`Agent conflict ${conflict} — size ×0.5`);
    if (input.conflictGate?.tradeBlocked) {
      blockReasons.push("Conflict gate blocks TRADE.");
    }
  } else if (conflict === "MEDIUM") {
    sizePct *= 0.8;
    reductions.push("Agent conflict MEDIUM — size ×0.8");
  }

  const confidence = input.agentConfidence ?? 50;
  if (confidence < 40) {
    sizePct *= 0.7;
    reductions.push(`Low agent confidence (${confidence}) — size ×0.7`);
  }

  if (input.regimeBrain) {
    const mult = input.regimeBrain.sizingMultiplier;
    if (mult < 1) {
      sizePct *= mult;
      reductions.push(
        `Regime ${input.regimeBrain.primaryRegime} — size ×${mult}`,
      );
    }
    if (input.regimeBrain.tradeFrequencyRecommendation === "PAUSE") {
      blockReasons.push("Regime Brain recommends PAUSE.");
    }
  }

  const openExp = input.portfolio.metrics.openExposurePct;
  const headroom = Math.max(0, maxAllowed - openExp);
  if (sizePct > headroom) {
    sizePct = headroom;
    reductions.push(`Open exposure ${openExp.toFixed(1)}% — capped to headroom ${headroom.toFixed(2)}%`);
  }

  const pilot = input.pilotConfig;
  if (pilot) {
    const pilotMaxPct =
      equity > 0
        ? (Math.min(pilot.pilotMaxNotionalUsd, pilot.liveMaxNotionalUsd) /
            equity) *
          100
        : maxAllowed;
    if (sizePct > pilotMaxPct) {
      sizePct = pilotMaxPct;
      reductions.push(`Live pilot notional cap — max ${pilotMaxPct.toFixed(2)}%`);
    }
  }

  sizePct = Math.max(0, Math.min(sizePct, maxAllowed));
  const recommendedRiskPct = Number(sizePct.toFixed(2));
  const riskBudgetRemainingPct = Number(Math.max(0, headroom - recommendedRiskPct).toFixed(2));
  const recommendedPositionSizeUsd = Number(
    ((equity * recommendedRiskPct) / 100).toFixed(2),
  );

  const liveTradingAllowed =
    blockReasons.length === 0 &&
    recommendedRiskPct > 0 &&
    !(input.killSwitch?.tradingPaused ?? false);

  return {
    generatedAt: new Date().toISOString(),
    recommendedRiskPct,
    maxAllowedRiskPct: maxAllowed,
    recommendedPositionSizeUsd,
    sizeReductionReasons: reductions,
    riskBudgetRemainingPct,
    strategyRiskAllocation: buildStrategyAllocation(input.portfolio, riskBudgetRemainingPct),
    assetRiskAllocation: buildAssetAllocation(input.portfolio, riskBudgetRemainingPct),
    liveTradingAllowed,
    blockReasons,
    dailyLossLimitPct: dailyLimit,
    weeklyLossLimitPct: weeklyLimit,
    dailyLossUsedPct: Number(dailyUsed.toFixed(1)),
    weeklyLossUsedPct: Number(weeklyUsed.toFixed(1)),
    timeline: buildTimeline(input.portfolio, maxAllowed),
    canReduceAutomatically: true,
    cannotIncreaseBeyondGovernanceMax: true,
    cannotOverrideKillSwitch: true,
    cannotBypassApproval: true,
    safetyNotice: RISK_BUDGET_SAFETY_NOTICE,
  };
}
