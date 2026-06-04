import type { AgentOutput, AgentRecommendation, CommitteeVerdict } from "@/lib/agents/types";
import { agentRecToTrade } from "@/lib/agents/types";
import type { DataConfidenceResult } from "@/lib/data-trust/types";
import type {
  ConflictGateResult,
  ConflictGateSource,
  StrategyConflictAnalysis,
} from "@/lib/data-trust/types";
import type { VerdictOutput, ActionPlan } from "@/lib/types/market";

export interface ApplyConflictGateInput {
  committee: CommitteeVerdict;
  riskManager: AgentOutput;
  dataTrust: DataConfidenceResult;
  conflict: StrategyConflictAnalysis;
}

function blockMessage(source: ConflictGateSource, detail: string): string {
  if (source === "DATA_TRUST") {
    return `TRADE BLOCKED BY DATA TRUST / CONFLICT GATE — ${detail}`;
  }
  if (source === "CONFLICT") {
    return `TRADE BLOCKED BY DATA TRUST / CONFLICT GATE — ${detail}`;
  }
  if (source === "RISK_VETO") {
    return `TRADE BLOCKED BY DATA TRUST / CONFLICT GATE — Risk Manager veto active. ${detail}`;
  }
  return detail;
}

export function applyConflictGate(input: ApplyConflictGateInput): {
  committee: CommitteeVerdict;
  conflictGate: ConflictGateResult;
} {
  const originalVerdict = input.committee.finalVerdict;
  let gatedVerdict: AgentRecommendation = originalVerdict;
  let gateSource: ConflictGateSource = "NONE";
  let blockReason = "";
  let paperOnlyRecommended = false;

  const pushReason = (source: ConflictGateSource, detail: string) => {
    if (!blockReason) {
      gateSource = source;
      blockReason = detail;
    }
  };

  if (input.committee.riskVeto && originalVerdict === "TRADE") {
    gatedVerdict = "SKIP";
    pushReason("RISK_VETO", input.riskManager.vetoReasons?.[0] ?? "Risk veto");
  }

  if (
    !input.dataTrust.tradeAllowed ||
    input.dataTrust.grade === "CRITICAL"
  ) {
    if (originalVerdict === "TRADE" || gatedVerdict === "TRADE") {
      gatedVerdict = input.dataTrust.criticalIssues.length > 2 ? "SKIP" : "WAIT";
      pushReason(
        "DATA_TRUST",
        input.dataTrust.criticalIssues[0] ?? "Critical data trust failure",
      );
    }
  } else if (input.dataTrust.grade === "LOW" && gatedVerdict === "TRADE") {
    gatedVerdict = "WAIT";
    pushReason("DATA_TRUST", "Data trust LOW — only WAIT or SKIP permitted");
  } else if (input.dataTrust.grade === "MEDIUM" && gatedVerdict === "TRADE") {
    gatedVerdict = "WAIT";
    paperOnlyRecommended = true;
    pushReason(
      "DATA_TRUST",
      "Data trust MEDIUM — paper-only / reduced confidence; no live TRADE",
    );
  }

  if (input.conflict.conflictLevel === "CRITICAL" && gatedVerdict === "TRADE") {
    gatedVerdict = input.conflict.suggestedAction === "SKIP" ? "SKIP" : "WAIT";
    pushReason(
      "CONFLICT",
      input.conflict.conflicts[0] ?? "Critical agent conflict",
    );
  } else if (input.conflict.conflictLevel === "HIGH" && gatedVerdict === "TRADE") {
    gatedVerdict = "WAIT";
    pushReason(
      "CONFLICT",
      input.conflict.conflicts[0] ?? "High agent conflict — committee must wait",
    );
  } else if (
    input.conflict.conflictLevel === "MEDIUM" &&
    gatedVerdict === "TRADE"
  ) {
    const riskApproves =
      input.riskManager.recommendation === "TRADE" && !input.riskManager.veto;
    if (!riskApproves) {
      gatedVerdict = "WAIT";
      paperOnlyRecommended = true;
      pushReason(
        "CONFLICT",
        "Medium conflict — Risk Manager has not approved TRADE",
      );
    }
  }

  const tradeBlocked =
    originalVerdict === "TRADE" && gatedVerdict !== "TRADE";

  const statusLabel = tradeBlocked
    ? blockMessage(gateSource, blockReason)
    : paperOnlyRecommended
      ? "Paper-only recommended — elevated data/conflict caution"
      : "Trade gate open — analysis flow allowed";

  const committee: CommitteeVerdict = {
    ...input.committee,
    finalVerdict: gatedVerdict,
    consensusSummary: tradeBlocked
      ? `${input.committee.consensusSummary} Gate: ${blockReason}`
      : input.committee.consensusSummary,
    disagreementNotes: tradeBlocked
      ? [
          ...input.committee.disagreementNotes,
          `Reliability gate: ${originalVerdict} → ${gatedVerdict}`,
        ]
      : input.committee.disagreementNotes,
    topReasons: tradeBlocked
      ? [blockReason, ...input.committee.topReasons].slice(0, 4)
      : input.committee.topReasons,
    finalActionPlan: tradeBlocked
      ? gatedVerdict === "SKIP"
        ? "No hypothetical orders — blocked by data trust / conflict gate."
        : "WAIT — resolve data trust or agent conflict before paper test."
      : input.committee.finalActionPlan,
  };

  return {
    committee,
    conflictGate: {
      tradeBlocked,
      blockReason: tradeBlocked ? blockMessage(gateSource, blockReason) : "",
      gateSource,
      originalVerdict,
      gatedVerdict,
      paperOnlyRecommended,
      statusLabel,
    },
  };
}

export function injectRiskManagerReliability(
  riskManager: AgentOutput,
  dataTrust: DataConfidenceResult,
  conflict: StrategyConflictAnalysis,
  gate: ConflictGateResult,
): AgentOutput {
  const reasons = [...riskManager.reasons];
  const vetoReasons = [...(riskManager.vetoReasons ?? [])];

  if (dataTrust.criticalIssues.length > 0) {
    reasons.unshift(`Data trust: ${dataTrust.criticalIssues[0]}`);
  }
  if (conflict.conflicts.length > 0) {
    reasons.push(`Conflict desk: ${conflict.conflicts[0]}`);
  }
  if (gate.tradeBlocked) {
    vetoReasons.push(gate.blockReason);
  }

  const veto =
    Boolean(riskManager.veto) ||
    gate.tradeBlocked ||
    dataTrust.grade === "CRITICAL" ||
    !dataTrust.tradeAllowed;

  return {
    ...riskManager,
    reasons: [...new Set(reasons)].slice(0, 8),
    veto,
    vetoReasons: veto ? [...new Set(vetoReasons)].slice(0, 6) : vetoReasons,
  };
}

export function alignPlaybookVerdictWithGate(
  verdict: VerdictOutput,
  actionPlan: ActionPlan,
  gated: AgentRecommendation,
  tradeBlocked: boolean,
): { verdict: VerdictOutput; actionPlan: ActionPlan } {
  if (!tradeBlocked) return { verdict, actionPlan };
  const rec = agentRecToTrade(gated);
  return {
    verdict: {
      ...verdict,
      recommendation: rec,
      summary: `${verdict.summary} Reliability gate applied: ${gated}.`,
    },
    actionPlan: {
      ...actionPlan,
      action: rec === "trade" ? actionPlan.action : "no_trade",
      entryNotes:
        gated === "SKIP"
          ? "No hypothetical entry — data trust / conflict gate."
          : "WAIT — data trust / conflict gate.",
    },
  };
}
