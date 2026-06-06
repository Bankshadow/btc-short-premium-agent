import { roleAllowsAction } from "./action-permissions";
import { LIVE_POLICY_ACTIONS } from "./config";
import type {
  PolicyDecision,
  PolicyInput,
  PolicyResult,
  PolicyRiskImpact,
} from "./types";

function isLiveAction(action: PolicyInput["action"]): boolean {
  return LIVE_POLICY_ACTIONS.includes(action);
}

function finalizeDecision(
  blockers: string[],
  approvals: string[],
  needsData: boolean,
): PolicyDecision {
  if (blockers.length > 0) return "BLOCK";
  if (needsData) return "REQUIRE_MORE_DATA";
  if (approvals.length > 0) return "REQUIRE_APPROVAL";
  return "ALLOW";
}

function failClosedResult(
  input: PolicyInput,
  error: string,
): PolicyResult {
  return {
    decision: "BLOCK",
    reasons: ["Policy evaluation failed — fail-closed for safety."],
    blockers: [error],
    requiredApprovals: [],
    riskImpact: "INCREASE_BLOCKED",
    auditRequired: true,
    notificationRequired: isLiveAction(input.action),
    evaluatedAt: new Date().toISOString(),
    action: input.action,
    ruleIds: ["policy_eval_error"],
    workspaceId: input.workspaceId,
  };
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  try {
    return evaluatePolicyInner(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy evaluation error";
    if (isLiveAction(input.action)) {
      return failClosedResult(input, message);
    }
    return {
      ...failClosedResult(input, message),
      notificationRequired: false,
    };
  }
}

function evaluatePolicyInner(input: PolicyInput): PolicyResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const requiredApprovals: string[] = [];
  const ruleIds: string[] = [];
  let needsData = false;
  let riskImpact: PolicyRiskImpact = "NEUTRAL";

  const gov = input.governance;
  const risk = input.risk;
  const cc = input.commandCenter;
  const lr = input.liveReadiness;
  const dt = input.dataTrust;
  const pm = input.preMortem;
  const cg = input.conflictGate;

  if (!roleAllowsAction(input.userRole, input.action)) {
    ruleIds.push("role_permission");
    blockers.push(
      `Role ${input.userRole} lacks permission for ${input.action}.`,
    );
  } else {
    reasons.push(`Role ${input.userRole} has permission for ${input.action}.`);
  }

  if (input.action === "EXECUTE_OPTIONS_LIVE") {
    ruleIds.push("options_live_unavailable");
    blockers.push("BTC options live execution is not available.");
  }

  if (gov?.pauseAnalysis && input.action === "RUN_ANALYSIS") {
    ruleIds.push("governance_pause");
    blockers.push("Governance: pause all analysis is ON.");
  }

  if (
    gov &&
    (gov.operatorPaused || gov.safeMode || gov.pausePaperAutoOpen) &&
    ["CREATE_PAPER_TRADE", "CREATE_SHADOW_TRADE", "ENABLE_AUTOPILOT"].includes(
      input.action,
    )
  ) {
    ruleIds.push("governance_pause");
    blockers.push("Governance pause / safe mode — no new trades or autopilot.");
  }

  if (gov?.disableAggressiveMode && ["PROMOTE_LIVE_STAGE", "ENABLE_AUTOPILOT"].includes(input.action)) {
    ruleIds.push("aggressive_disabled");
    blockers.push("Aggressive mode disabled by governance.");
  }

  if (risk?.killSwitchActive || risk?.tradingPaused) {
    if (
      [
        "CREATE_PAPER_TRADE",
        "PREVIEW_LIVE_ORDER",
        "EXECUTE_LIVE_PERP",
        "ENABLE_AUTOPILOT",
        "PROMOTE_LIVE_STAGE",
      ].includes(input.action)
    ) {
      ruleIds.push("kill_switch");
      blockers.push("Kill switch / trading pause active.");
    }
    if (input.action === "TRIGGER_KILL_SWITCH") {
      ruleIds.push("kill_switch_reduce_only");
      riskImpact = "REDUCE";
      reasons.push("Kill switch action is risk-reducing only.");
    }
  }

  if (input.action === "TRIGGER_KILL_SWITCH" && !risk?.killSwitchActive) {
    ruleIds.push("kill_switch_reduce_only");
    riskImpact = "REDUCE";
    reasons.push("Kill switch may only reduce risk.");
  }

  if (
    pm?.blocksTicket &&
    [
      "CREATE_PAPER_TRADE",
      "EXECUTE_LIVE_PERP",
      "EXECUTE_OPTIONS_TESTNET",
      "EXECUTE_BINANCE_TESTNET",
    ].includes(input.action)
  ) {
    ruleIds.push("pre_mortem_block");
    blockers.push(pm.summary ?? "Pre-mortem BLOCK — action not allowed.");
  }

  if (cg?.blocked && ["CREATE_PAPER_TRADE", "EXECUTE_LIVE_PERP"].includes(input.action)) {
    ruleIds.push("conflict_gate");
    blockers.push(cg.reason ?? "Conflict gate blocked this action.");
  }

  if (risk?.hardRiskVeto && input.action === "CREATE_PAPER_TRADE") {
    ruleIds.push("paper_risk_veto");
    blockers.push("Risk manager hard veto — strict paper blocked.");
  }

  if (input.action === "CREATE_SHADOW_TRADE") {
    ruleIds.push("shadow_relaxed");
    if (gov?.operatorPaused || gov?.safeMode) {
      blockers.push("Shadow blocked — governance pause active.");
    } else if (risk?.hardRiskVeto) {
      reasons.push("Shadow may proceed under relaxed conditions despite risk veto.");
    } else {
      reasons.push("Shadow trade allowed under relaxed policy.");
    }
  }

  if (dt?.critical || dt?.grade === "CRITICAL") {
    if (isLiveAction(input.action) || input.action === "CREATE_PAPER_TRADE") {
      ruleIds.push("data_trust_live");
      blockers.push(`Data trust CRITICAL (${dt.score}/100).`);
    }
  } else if (dt && dt.score < 50 && isLiveAction(input.action)) {
    ruleIds.push("data_trust_live");
    blockers.push(`Data trust too low for live (${dt.score}/100).`);
  }

  if (input.backboneHealthy === false && isLiveAction(input.action)) {
    ruleIds.push("backbone_healthy");
    blockers.push("Data backbone unhealthy — live blocked.");
  }

  if (input.auditAvailable === false && ["EXECUTE_LIVE_PERP", "EXECUTE_OPTIONS_LIVE"].includes(input.action)) {
    ruleIds.push("audit_available");
    blockers.push("Live audit logging unavailable.");
  }

  if (cc && cc.status !== "SAFE" && isLiveAction(input.action)) {
    ruleIds.push("command_center_safe");
    blockers.push(
      `Command center ${cc.status} — live requires SAFE. ${cc.blockers[0] ?? ""}`.trim(),
    );
  }

  if (lr?.status === "FAIL" && ["PREVIEW_LIVE_ORDER", "EXECUTE_LIVE_PERP"].includes(input.action)) {
    ruleIds.push("live_readiness");
    blockers.push(lr.blockers[0] ?? "Live readiness FAIL.");
  }

  if (input.action === "EXECUTE_LIVE_PERP") {
    ruleIds.push("live_human_approval");
    if (!input.operatorApproval) {
      requiredApprovals.push("OPERATOR_APPROVAL");
      reasons.push("Live perp requires explicit operator approval.");
    }
    if (!input.doubleConfirm) {
      requiredApprovals.push("DOUBLE_CONFIRM");
    }
    if (input.environmentMode !== "LIVE" && input.environmentMode !== "LIVE_ENABLED") {
      blockers.push(`Environment ${input.environmentMode} — live perp not enabled.`);
    }
  }

  if (input.action === "PREVIEW_LIVE_ORDER" && !input.latestAnalysis) {
    needsData = true;
    reasons.push("Run desk analysis before live preview.");
  }

  if (input.action === "RUN_ANALYSIS" && !input.latestAnalysis && blockers.length === 0) {
    reasons.push("Analysis permitted — market data will be fetched.");
  }

  if (input.action === "PROMOTE_LIVE_STAGE" && lr && !lr.readyForPilot) {
    blockers.push("Live readiness criteria not met for stage promotion.");
    ruleIds.push("live_readiness");
  }

  const obs = input.observability;
  if (obs) {
    if (!obs.databaseHealthy && isLiveAction(input.action)) {
      ruleIds.push("observability_database");
      blockers.push("Database health failure — live blocked by observability.");
    }
    if (obs.criticalTradingRisk && isLiveAction(input.action)) {
      ruleIds.push("observability_trading_risk");
      blockers.push("Critical trading risk detected — live blocked.");
    }
    if (obs.liveTradingPosture === "BLOCKED" && isLiveAction(input.action)) {
      ruleIds.push("observability_posture");
      blockers.push("Platform live trading posture BLOCKED.");
    }
    if (
      obs.liveTradingPosture === "CAUTION" &&
      !obs.alertDeliveryHealthy &&
      isLiveAction(input.action)
    ) {
      ruleIds.push("observability_alerts");
      blockers.push("Alert delivery unhealthy — live requires CAUTION or BLOCK.");
    }
  }

  const decision = finalizeDecision(blockers, requiredApprovals, needsData);
  const auditRequired = decision !== "ALLOW" || isLiveAction(input.action);
  const notificationRequired =
    decision === "BLOCK" && isLiveAction(input.action);

  if (decision === "ALLOW") {
    reasons.push(`${input.action} allowed by policy engine.`);
  }

  return {
    decision,
    reasons,
    blockers,
    requiredApprovals,
    riskImpact,
    auditRequired,
    notificationRequired,
    evaluatedAt: new Date().toISOString(),
    action: input.action,
    ruleIds,
    workspaceId: input.workspaceId,
  };
}

export function policyAllows(input: PolicyInput): boolean {
  const result = evaluatePolicy(input);
  return result.decision === "ALLOW";
}

export function policyBlockedMessage(result: PolicyResult): string {
  if (result.blockers.length > 0) return result.blockers.join("; ");
  if (result.requiredApprovals.length > 0) {
    return `Requires: ${result.requiredApprovals.join(", ")}`;
  }
  if (result.decision === "REQUIRE_MORE_DATA") {
    return result.reasons.find((r) => r.includes("analysis")) ?? "More data required.";
  }
  return "Action not allowed.";
}
