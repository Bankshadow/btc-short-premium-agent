import {
  LOOP_GUARD_THRESHOLDS,
  LOOP_GUARD_WINDOW_MINUTES,
} from "./config";
import type {
  LoopGuardActionRecord,
  LoopGuardDecision,
  LoopGuardMetrics,
  LoopGuardState,
  LoopRiskLevel,
} from "./types";
import { attachSelfCheckToDecision } from "./self-check";

function withinWindow(timestamp: string, windowMinutes: number): boolean {
  return Date.now() - new Date(timestamp).getTime() <= windowMinutes * 60_000;
}

function maxRepeats(values: (string | null | undefined)[]): number {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  return max;
}

function countStaleMarketCycles(records: LoopGuardActionRecord[]): number {
  const hashes = records
    .filter((r) => r.marketContextHash)
    .map((r) => r.marketContextHash as string);
  if (hashes.length < 2) return 0;
  const latest = hashes[0];
  let streak = 1;
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] === latest) streak++;
    else break;
  }
  return streak;
}

export function computeLoopGuardMetrics(
  records: LoopGuardActionRecord[],
  windowMinutes = LOOP_GUARD_WINDOW_MINUTES,
): LoopGuardMetrics {
  const windowed = records.filter((r) => withinWindow(r.timestamp, windowMinutes));
  const totalActions = windowed.length;
  const actionKeys = windowed.map((r) => r.actionKey);
  const uniqueActionKeys = new Set(actionKeys).size;
  const successCount = windowed.filter((r) => r.success).length;
  const failureCount = windowed.filter((r) => r.failed).length;
  const repeatedFailureCount = windowed.filter(
    (r) => r.failed && r.apiErrorKey,
  ).length;

  const reasons: string[] = [];
  const maxSameActionRepeats = maxRepeats(actionKeys);
  const maxSameCandidateRepeats = maxRepeats(
    windowed.map((r) => r.tradeCandidateKey),
  );
  const maxSameApiFailureRepeats = maxRepeats(
    windowed.map((r) => r.apiErrorKey),
  );
  const staleMarketContextCycles = countStaleMarketCycles(windowed);
  const duplicatePreviewAttempts = windowed.filter((r) =>
    r.summary?.includes("DUPLICATE_PREVIEW"),
  ).length;
  const duplicateOrderAttempts = windowed.filter((r) =>
    r.summary?.includes("DUPLICATE_ORDER"),
  ).length;

  if (maxSameActionRepeats >= LOOP_GUARD_THRESHOLDS.suspiciousSameAction) {
    reasons.push(`Same action repeated ${maxSameActionRepeats}×`);
  }
  if (maxSameApiFailureRepeats >= LOOP_GUARD_THRESHOLDS.suspiciousApiFailures) {
    reasons.push(`API failure repeated ${maxSameApiFailureRepeats}×`);
  }
  if (maxSameCandidateRepeats >= LOOP_GUARD_THRESHOLDS.suspiciousCandidateRepeats) {
    reasons.push(`Same trade candidate repeated ${maxSameCandidateRepeats}×`);
  }
  if (staleMarketContextCycles >= LOOP_GUARD_THRESHOLDS.suspiciousStaleMarket) {
    reasons.push(`Market context unchanged ${staleMarketContextCycles} cycles`);
  }
  if (duplicatePreviewAttempts > 0) {
    reasons.push(`${duplicatePreviewAttempts} duplicate preview attempt(s)`);
  }
  if (duplicateOrderAttempts > 0) {
    reasons.push(`${duplicateOrderAttempts} duplicate order attempt(s)`);
  }

  const actionDiversity =
    totalActions > 0 ? uniqueActionKeys / totalActions : 1;
  const successRate = totalActions > 0 ? successCount / totalActions : 1;

  let loopRiskLevel: LoopRiskLevel = "PRODUCTIVE";
  let suspiciousSignals = 0;
  let stuckSignals = 0;

  if (maxSameActionRepeats >= LOOP_GUARD_THRESHOLDS.stuckSameAction) stuckSignals++;
  else if (maxSameActionRepeats >= LOOP_GUARD_THRESHOLDS.suspiciousSameAction) suspiciousSignals++;

  if (maxSameApiFailureRepeats >= LOOP_GUARD_THRESHOLDS.stuckApiFailures) stuckSignals++;
  else if (maxSameApiFailureRepeats >= LOOP_GUARD_THRESHOLDS.suspiciousApiFailures) suspiciousSignals++;

  if (maxSameCandidateRepeats >= LOOP_GUARD_THRESHOLDS.stuckCandidateRepeats) stuckSignals++;
  else if (maxSameCandidateRepeats >= LOOP_GUARD_THRESHOLDS.suspiciousCandidateRepeats) suspiciousSignals++;

  if (staleMarketContextCycles >= LOOP_GUARD_THRESHOLDS.stuckStaleMarket) stuckSignals++;
  else if (staleMarketContextCycles >= LOOP_GUARD_THRESHOLDS.suspiciousStaleMarket) suspiciousSignals++;

  if (
    failureCount >= LOOP_GUARD_THRESHOLDS.stuckFailureStreak &&
    successRate <= LOOP_GUARD_THRESHOLDS.stuckSuccessRate
  ) {
    stuckSignals++;
    reasons.push("No success-state improvement");
  } else if (
    failureCount >= LOOP_GUARD_THRESHOLDS.suspiciousFailureStreak &&
    successRate <= LOOP_GUARD_THRESHOLDS.suspiciousSuccessRate
  ) {
    suspiciousSignals++;
    reasons.push("Low success rate with repeated failures");
  }

  if (actionDiversity <= LOOP_GUARD_THRESHOLDS.stuckDiversity && totalActions >= 4) {
    stuckSignals++;
  } else if (
    actionDiversity <= LOOP_GUARD_THRESHOLDS.suspiciousDiversity &&
    totalActions >= 3
  ) {
    suspiciousSignals++;
  }

  if (duplicateOrderAttempts >= 1) stuckSignals++;
  if (duplicatePreviewAttempts >= 2) suspiciousSignals++;

  if (stuckSignals >= LOOP_GUARD_THRESHOLDS.stuckSignalsToStop) {
    loopRiskLevel = "STUCK";
  } else if (
    suspiciousSignals >= LOOP_GUARD_THRESHOLDS.suspiciousSignalsToEscalate ||
    stuckSignals >= 1
  ) {
    loopRiskLevel = "SUSPICIOUS";
  }

  return {
    windowMinutes,
    totalActions,
    uniqueActionKeys,
    actionDiversity,
    successCount,
    failureCount,
    successRate,
    repeatedFailureCount,
    maxSameActionRepeats,
    maxSameCandidateRepeats,
    maxSameApiFailureRepeats,
    staleMarketContextCycles,
    duplicatePreviewAttempts,
    duplicateOrderAttempts,
    loopRiskLevel,
    reasons,
  };
}

function hasActivePermission(state: LoopGuardState): boolean {
  if (!state.suspiciousPermissionGrantedUntil) return false;
  return Date.now() < new Date(state.suspiciousPermissionGrantedUntil).getTime();
}

export function evaluateLoopGuardFromState(
  state: LoopGuardState,
  windowMinutes = LOOP_GUARD_WINDOW_MINUTES,
): LoopGuardDecision {
  if (state.blocker.active) {
    const metrics =
      state.blocker.metrics ??
      computeLoopGuardMetrics(state.records, windowMinutes);
    return {
      level: "STUCK",
      continue: false,
      requiresSelfCheck: false,
      requiresPermission: false,
      stopLoop: true,
      reason: state.blocker.reason,
      reasons: metrics.reasons,
      metrics: { ...metrics, loopRiskLevel: "STUCK" },
    };
  }

  const metrics = computeLoopGuardMetrics(state.records, windowMinutes);
  const level = metrics.loopRiskLevel;

  if (level === "PRODUCTIVE") {
    return {
      level,
      continue: true,
      requiresSelfCheck: false,
      requiresPermission: false,
      stopLoop: false,
      reason: "Autopilot cycle is productive — continuing.",
      reasons: metrics.reasons,
      metrics,
    };
  }

  if (level === "SUSPICIOUS") {
    const permitted = hasActivePermission(state);
    const decision: LoopGuardDecision = {
      level,
      continue: permitted,
      requiresSelfCheck: true,
      requiresPermission: !permitted,
      stopLoop: false,
      reason: permitted
        ? "Suspicious loop cleared by operator — continuing one cycle."
        : `Suspicious autopilot loop — ${metrics.reasons[0] ?? "repeated low-value actions"}.`,
      reasons: metrics.reasons,
      metrics,
    };
    return attachSelfCheckToDecision(decision);
  }

  const reason =
    metrics.reasons.length > 0
      ? `Autopilot stuck: ${metrics.reasons.slice(0, 2).join(" · ")}`
      : "Autopilot stuck — repeated useless actions with no progress.";

  return {
    level: "STUCK",
    continue: false,
    requiresSelfCheck: false,
    requiresPermission: false,
    stopLoop: true,
    reason,
    reasons: metrics.reasons,
    metrics,
  };
}
