import type { AnalyzeApiResponse } from "@/lib/types/market";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import {
  paperModeAllowsPaperCreate,
  paperModeAllowsShadowCreate,
} from "./config";
import type {
  PaperAutopilotMode,
  PaperAutopilotSettings,
  PaperCreateEvaluation,
} from "./types";
import {
  countPaperTradesOpenedToday,
  countShadowTradesOpenedToday,
} from "@/lib/autopilot/apply-paper-effects";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { buildPolicyInput, evaluatePolicy } from "@/lib/policy-engine";

function committeeVerdict(data: AnalyzeApiResponse): string {
  return String(
    data.tradingDesk?.committee.finalVerdict ?? data.step5_verdict.recommendation,
  ).toUpperCase();
}

function hasHardRiskVeto(data: AnalyzeApiResponse): boolean {
  return Boolean(
    data.tradingDesk?.committee.riskVeto || data.tradingDesk?.riskManager.veto,
  );
}

function governanceBlocksNewTrades(gov: GovernanceDeskState): boolean {
  return Boolean(
    gov.operatorPaused || gov.safeMode || gov.pausePaperAutoOpen,
  );
}

export function evaluatePaperAutopilotCreate(input: {
  mode: PaperAutopilotMode;
  data: AnalyzeApiResponse;
  settings: PaperAutopilotSettings;
  governance: GovernanceDeskState;
  orders: PaperOrder[];
}): PaperCreateEvaluation {
  const { mode, data, settings, governance, orders } = input;

  if (mode === "OFF") {
    return {
      action: "NONE",
      reason: "Paper autopilot off.",
      blocked: true,
      blockReason: "MODE_OFF",
    };
  }

  if (governanceBlocksNewTrades(governance)) {
    return {
      action: "NONE",
      reason: "Governance kill switch / pause — no new trades.",
      blocked: true,
      blockReason: "GOVERNANCE_KILL",
    };
  }

  const policyAction =
    mode === "SHADOW_ONLY"
      ? ("CREATE_SHADOW_TRADE" as const)
      : ("CREATE_PAPER_TRADE" as const);
  const policy = evaluatePolicy(
    buildPolicyInput({
      workspaceId: "default-ws",
      userRole: "TRADER",
      environmentMode: "PAPER",
      action: policyAction,
      latestAnalysis: data,
      governance,
      entries: [],
      orders,
    }),
  );
  if (policy.decision === "BLOCK") {
    const blockReason = policy.ruleIds.includes("pre_mortem_block")
      ? "PRE_MORTEM_BLOCK"
      : policy.ruleIds.includes("governance_pause") ||
          policy.ruleIds.includes("kill_switch")
        ? "GOVERNANCE_KILL"
        : policy.ruleIds.includes("paper_risk_veto")
          ? "RISK_VETO"
          : policy.ruleIds.includes("data_trust_live")
            ? "DATA_TRUST"
            : "POLICY_BLOCK";
    return {
      action: "NONE",
      reason: policy.blockers[0] ?? "Policy blocked paper create.",
      blocked: true,
      blockReason,
    };
  }

  const verdict = committeeVerdict(data);
  const preMortemBlock = preMortemBlocksTicket(data.preMortem);
  const riskVeto = hasHardRiskVeto(data);
  const confidence = data.step5_verdict.confidence ?? 0;

  if (verdict === "TRADE" && paperModeAllowsPaperCreate(mode)) {
    if (preMortemBlock) {
      return {
        action: "NONE",
        reason: "Pre-mortem BLOCK — paper trade blocked.",
        blocked: true,
        blockReason: "PRE_MORTEM_BLOCK",
      };
    }
    if (riskVeto) {
      const shadowOk = paperModeAllowsShadowCreate(mode);
      return {
        action: shadowOk ? "CREATE_SHADOW" : "NONE",
        reason: shadowOk
          ? "Risk veto — shadow trace only."
          : "Risk veto — no paper trade.",
        blocked: !shadowOk,
        blockReason: "RISK_VETO",
      };
    }
    if (mode === "PAPER_STRICT" && data.dataTrust?.grade === "CRITICAL") {
      return {
        action: "NONE",
        reason: "Data trust CRITICAL — strict paper blocked.",
        blocked: true,
        blockReason: "DATA_TRUST",
      };
    }

    const today = countPaperTradesOpenedToday(orders);
    if (today >= settings.maxPaperTradesPerDay) {
      return {
        action: "NONE",
        reason: `Daily paper limit (${settings.maxPaperTradesPerDay}) reached.`,
        blocked: true,
        blockReason: "DAILY_LIMIT",
      };
    }

    return {
      action: "CREATE_PAPER",
      reason:
        mode === "PAPER_STRICT"
          ? "TRADE verdict — strict paper entry."
          : "TRADE verdict — paper entry.",
      blocked: false,
      blockReason: null,
    };
  }

  if (
    (verdict === "WAIT" || verdict === "SKIP") &&
    paperModeAllowsShadowCreate(mode) &&
    confidence >= settings.shadowMinConfidence
  ) {
    if (preMortemBlock && mode !== "SHADOW_ONLY" && mode !== "PAPER_RELAXED") {
      return {
        action: "NONE",
        reason: "Pre-mortem BLOCK — shadow blocked.",
        blocked: true,
        blockReason: "PRE_MORTEM_BLOCK",
      };
    }

    const today = countShadowTradesOpenedToday(orders);
    if (today >= settings.maxShadowTradesPerDay) {
      return {
        action: "NONE",
        reason: `Daily shadow limit (${settings.maxShadowTradesPerDay}) reached.`,
        blocked: true,
        blockReason: "DAILY_LIMIT",
      };
    }

    return {
      action: "CREATE_SHADOW",
      reason: `${verdict} @ ${confidence}% — high-confidence shadow trace.`,
      blocked: false,
      blockReason: null,
    };
  }

  if (preMortemBlock) {
    return {
      action: "NONE",
      reason: "Pre-mortem BLOCK.",
      blocked: true,
      blockReason: "PRE_MORTEM_BLOCK",
    };
  }

  return {
    action: "NONE",
    reason: `${verdict} — no autopilot create rule matched.`,
    blocked: false,
    blockReason: null,
  };
}
