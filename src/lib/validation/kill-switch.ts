import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { loadOperatorOverrides } from "@/lib/operator/operator-override";
import { VALIDATION_THRESHOLDS } from "./validation-config";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { KillSwitchReason, KillSwitchStatus } from "./validation-types";

export const KILL_SWITCH_STORAGE_KEY =
  "trading-agents-crypto-desk:kill-switch-state";

export interface KillSwitchPersistedState {
  operatorPaused: boolean;
  operatorPauseReason: string;
  operatorPausedAt: string | null;
  cooldownUntil: string | null;
  lastTriggeredReason: KillSwitchReason | null;
}

export const DEFAULT_KILL_SWITCH_STATE: KillSwitchPersistedState = {
  operatorPaused: false,
  operatorPauseReason: "",
  operatorPausedAt: null,
  cooldownUntil: null,
  lastTriggeredReason: null,
};

export function loadKillSwitchState(): KillSwitchPersistedState {
  if (typeof window === "undefined") return DEFAULT_KILL_SWITCH_STATE;
  try {
    const raw = localStorage.getItem(KILL_SWITCH_STORAGE_KEY);
    if (!raw) return DEFAULT_KILL_SWITCH_STATE;
    return { ...DEFAULT_KILL_SWITCH_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_KILL_SWITCH_STATE;
  }
}

export function saveKillSwitchState(
  patch: Partial<KillSwitchPersistedState>,
): KillSwitchPersistedState {
  const next = { ...loadKillSwitchState(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(KILL_SWITCH_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

function pnlInWindow(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  sinceMs: number,
): number {
  let sum = 0;
  for (const e of entries) {
    if (new Date(e.timestamp).getTime() < sinceMs) continue;
    if (e.paperPnl != null) sum += e.paperPnl;
  }
  for (const o of orders) {
    if (o.status !== "CLOSED" || !o.closedAt) continue;
    if (new Date(o.closedAt).getTime() < sinceMs) continue;
    sum += o.realizedPnlPct ?? 0;
  }
  return sum;
}

function portfolioDrawdown(entries: DecisionLogEntry[]): number {
  const series = entries
    .filter((e) => e.outcomeStatus === "RESOLVED" && e.paperPnl != null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((e) => e.paperPnl!);
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of series) {
    equity += r;
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  return maxDd;
}

function consecutiveLosses(entries: DecisionLogEntry[]): number {
  const resolved = entries
    .filter((e) => e.outcomeStatus === "RESOLVED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  let streak = 0;
  for (const e of resolved) {
    const pnl = e.paperPnl ?? 0;
    if (pnl < 0 || e.resolution?.tradeWouldWin === false) streak += 1;
    else break;
  }
  return streak;
}

export function evaluateKillSwitch(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  latestAnalysis?: AnalyzeApiResponse | null;
  persisted?: KillSwitchPersistedState;
}): KillSwitchStatus {
  const t = VALIDATION_THRESHOLDS;
  const persisted = input.persisted ?? DEFAULT_KILL_SWITCH_STATE;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  const dailyPnlPct = pnlInWindow(input.entries, input.orders, now - dayMs);
  const weeklyPnlPct = pnlInWindow(input.entries, input.orders, now - weekMs);
  const peakToTroughDrawdownPct = portfolioDrawdown(input.entries);
  const lossStreak = consecutiveLosses(input.entries);

  const dqScore =
    input.latestAnalysis?.tradingDesk?.research.dataQualityScore ?? null;

  const reasons: KillSwitchReason[] = [];
  const messages: string[] = [];

  if (persisted.operatorPaused) {
    reasons.push("operator_pause");
    messages.push(
      persisted.operatorPauseReason || "Operator paused desk trading.",
    );
  }

  if (dailyPnlPct <= t.dailyLossLimitPct) {
    reasons.push("daily_loss_limit");
    messages.push(`Daily PnL ${dailyPnlPct}% ≤ ${t.dailyLossLimitPct}%.`);
  }
  if (weeklyPnlPct <= t.weeklyLossLimitPct) {
    reasons.push("weekly_loss_limit");
    messages.push(`Weekly PnL ${weeklyPnlPct}% ≤ ${t.weeklyLossLimitPct}%.`);
  }
  if (peakToTroughDrawdownPct >= t.portfolioMaxDrawdownPct) {
    reasons.push("max_drawdown");
    messages.push(
      `Drawdown ${peakToTroughDrawdownPct}% ≥ ${t.portfolioMaxDrawdownPct}%.`,
    );
  }
  if (lossStreak >= t.lossStreakCooldown) {
    reasons.push("loss_streak_cooldown");
    messages.push(`${lossStreak} consecutive losses — cooldown.`);
  }
  if (
    dqScore != null &&
    dqScore < t.dataQualityLockoutScore &&
    !isTestnetPrimaryAutomation()
  ) {
    reasons.push("data_quality_lockout");
    messages.push(`Data quality ${dqScore}/100 below lockout.`);
  }

  const aggressivePnl = input.entries
    .filter((e) => e.deskRiskProfile === "aggressive" && e.paperPnl != null)
    .reduce((s, e) => s + (e.paperPnl ?? 0), 0);
  if (
    input.riskProfile === "aggressive" &&
    aggressivePnl <= t.aggressiveMaxLossPct
  ) {
    reasons.push("aggressive_mode_lockout");
    messages.push(`Aggressive mode cumulative ${aggressivePnl}%.`);
  }

  let cooldownUntil = persisted.cooldownUntil;
  if (
    reasons.includes("loss_streak_cooldown") ||
    reasons.includes("max_drawdown")
  ) {
    if (!cooldownUntil || new Date(cooldownUntil).getTime() < now) {
      cooldownUntil = new Date(
        now + t.cooldownHours * 60 * 60 * 1000,
      ).toISOString();
    }
  }

  const inCooldown =
    cooldownUntil != null && new Date(cooldownUntil).getTime() > now;

  const tradingPaused =
    reasons.length > 0 || inCooldown;
  const aggressiveBlocked =
    reasons.includes("aggressive_mode_lockout") ||
    reasons.includes("data_quality_lockout") ||
    tradingPaused;

  return {
    tradingPaused,
    aggressiveBlocked,
    activeReasons: reasons,
    cooldownUntil: inCooldown ? cooldownUntil : null,
    dailyPnlPct: Number(dailyPnlPct.toFixed(2)),
    weeklyPnlPct: Number(weeklyPnlPct.toFixed(2)),
    peakToTroughDrawdownPct: Number(peakToTroughDrawdownPct.toFixed(2)),
    consecutiveLosses: lossStreak,
    dataQualityScore: dqScore,
    messages,
  };
}

export function recentOperatorOverrides(limit = 8) {
  return loadOperatorOverrides().slice(0, limit).map((o) => ({
    logEntryId: o.logEntryId,
    verdict: o.disagreeWithVerdict,
    reason: o.reason,
    createdAt: o.createdAt,
  }));
}
