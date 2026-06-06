import { LOOP_GUARD_THRESHOLDS } from "./config";
import { buildLoopGuardBlocker, buildStuckOperatorAction } from "./build-blocker";
import {
  evaluateLoopGuardFromState,
  computeLoopGuardMetrics,
} from "./evaluate-loop";
import {
  loadLoopGuardState,
  patchLoopGuardState,
  saveLoopGuardState,
} from "./guard-store";
import { attachSelfCheckToDecision } from "./self-check";
import type { LoopGuardDecision, LoopGuardState } from "./types";

export async function evaluateLoopGuard(
  workspaceId = "server-default",
): Promise<LoopGuardDecision> {
  const state = await loadLoopGuardState(workspaceId);
  return evaluateLoopGuardFromState(state);
}

export async function applyStuckLoopGuard(
  decision: LoopGuardDecision,
  workspaceId = "server-default",
): Promise<LoopGuardState> {
  const blocker = buildLoopGuardBlocker(decision);
  const state = await patchLoopGuardState(
    {
      blocker,
      lastSelfCheckAt: new Date().toISOString(),
      lastSelfCheckSummary: decision.selfCheckSummary ?? decision.reason,
    },
    workspaceId,
  );
  return state;
}

export async function grantSuspiciousLoopPermission(
  workspaceId = "server-default",
): Promise<LoopGuardState> {
  const until = new Date(
    Date.now() + LOOP_GUARD_THRESHOLDS.permissionGrantMinutes * 60_000,
  ).toISOString();
  return patchLoopGuardState(
    {
      suspiciousPermissionGrantedUntil: until,
      lastSelfCheckAt: new Date().toISOString(),
    },
    workspaceId,
  );
}

export async function clearLoopGuardBlocker(
  workspaceId = "server-default",
): Promise<LoopGuardState> {
  const state = await loadLoopGuardState(workspaceId);
  state.blocker = {
    active: false,
    reason: "",
    stoppedAt: null,
    actionItemId: null,
    loopRiskLevel: null,
    metrics: null,
  };
  state.suspiciousPermissionGrantedUntil = null;
  await saveLoopGuardState(state);
  return state;
}

export async function runPreCycleLoopCheck(
  workspaceId = "server-default",
): Promise<{
  decision: LoopGuardDecision;
  blocked: boolean;
  operatorAction?: ReturnType<typeof buildStuckOperatorAction>;
}> {
  const state = await loadLoopGuardState(workspaceId);
  let decision = evaluateLoopGuardFromState(state);

  if (decision.level === "SUSPICIOUS" && decision.requiresSelfCheck) {
    decision = attachSelfCheckToDecision(decision);
    await patchLoopGuardState(
      {
        lastSelfCheckAt: new Date().toISOString(),
        lastSelfCheckSummary: decision.selfCheckSummary ?? null,
      },
      workspaceId,
    );
  }

  if (decision.stopLoop) {
    const blocker = buildLoopGuardBlocker(decision);
    await patchLoopGuardState({ blocker }, workspaceId);
    const operatorAction = buildStuckOperatorAction(decision, blocker);
    return { decision, blocked: true, operatorAction };
  }

  if (decision.level === "SUSPICIOUS" && !decision.continue) {
    return { decision, blocked: true };
  }

  return { decision, blocked: false };
}

export async function getLoopGuardDashboardSnapshot(workspaceId = "server-default") {
  const state = await loadLoopGuardState(workspaceId);
  const decision = evaluateLoopGuardFromState(state);
  const metrics = computeLoopGuardMetrics(state.records);
  return {
    decision,
    blocker: state.blocker,
    metrics,
    lastSelfCheckSummary: state.lastSelfCheckSummary,
    permissionGrantedUntil: state.suspiciousPermissionGrantedUntil,
  };
}
