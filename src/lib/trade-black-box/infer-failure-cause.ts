import type {
  BlackBoxFailureCategory,
  BlackBoxOutcomeStatus,
  TradeBlackBoxFailureCause,
  TradeBlackBoxSections,
  TradeBlackBoxTimelineEntry,
} from "./types";

function firstError(entries: TradeBlackBoxTimelineEntry[]): string | null {
  for (const entry of entries) {
    if (entry.error) return entry.error;
  }
  return null;
}

function hasSectionError(
  sections: TradeBlackBoxSections,
  key: keyof TradeBlackBoxSections,
): string | null {
  const section = sections[key];
  if (!section) return null;
  if (Array.isArray(section)) {
    for (const item of section) {
      const err = item.error;
      if (typeof err === "string" && err.trim()) return err;
    }
    return null;
  }
  const err = section.error;
  if (typeof err === "string" && err.trim()) return err;
  const blocked = section.blocked;
  if (blocked === true) {
    const reasons = section.blockReasons;
    if (Array.isArray(reasons) && reasons.length > 0) {
      return String(reasons[0]);
    }
    return "Blocked";
  }
  return null;
}

export function inferOutcomeStatus(input: {
  sections: TradeBlackBoxSections;
  timeline: TradeBlackBoxTimelineEntry[];
}): BlackBoxOutcomeStatus {
  const exchange = input.sections.exchangeResponse;
  const status =
    exchange && typeof exchange.status === "string" ? exchange.status : null;
  if (status === "BLOCKED" || status === "FAILED") return status;
  if (input.sections.preview?.blocked === true) return "BLOCKED";
  if (input.sections.aiDecision?.riskVeto === true) return "BLOCKED";
  if (input.sections.closeEvent || input.sections.pnl) return "CLOSED";
  if (status === "FILLED" || status === "SUBMITTED" || status === "CLOSING") {
    return "OPEN";
  }
  const err = firstError(input.timeline);
  if (err) return "FAILED";
  return "UNKNOWN";
}

export function inferFailureCause(input: {
  sections: TradeBlackBoxSections;
  timeline: TradeBlackBoxTimelineEntry[];
  outcomeStatus: BlackBoxOutcomeStatus;
}): TradeBlackBoxFailureCause {
  const evidence: string[] = [];
  const push = (line: string) => {
    if (!evidence.includes(line)) evidence.push(line);
  };

  if (input.sections.aiDecision?.riskVeto === true) {
    push("AI risk veto was active at decision time.");
    const reasons = input.sections.aiDecision.topReasons;
    if (Array.isArray(reasons)) {
      for (const r of reasons.slice(0, 3)) push(String(r));
    }
    return {
      category: "AI_VETO",
      headline: "AI committee veto blocked the trade path",
      detail:
        "The decision log shows riskVeto=true — downstream execution should not proceed without override.",
      evidence,
      severity: "HIGH",
    };
  }

  const previewErr = hasSectionError(input.sections, "preview");
  if (previewErr || input.sections.preview?.blocked === true) {
    push(previewErr ?? "Order preview was blocked.");
    const reasons = input.sections.preview?.blockReasons;
    if (Array.isArray(reasons)) {
      for (const r of reasons.slice(0, 3)) push(String(r));
    }
    return {
      category: "PREVIEW_BLOCKED",
      headline: "Order preview blocked before submission",
      detail: "Risk or validation checks rejected the preview — no exchange order was sent.",
      evidence,
      severity: "HIGH",
    };
  }

  const riskErr = hasSectionError(input.sections, "riskChecks");
  if (riskErr) {
    push(riskErr);
    const checks = input.sections.riskChecks?.checks;
    if (Array.isArray(checks)) {
      for (const c of checks) {
        if (c && typeof c === "object" && (c as { status?: string }).status === "FAIL") {
          push(String((c as { label?: string }).label ?? "Risk check failed"));
        }
      }
    }
    return {
      category: "RISK_BLOCKED",
      headline: "Risk gate blocked the trade",
      detail: "One or more risk checks failed before or during execution.",
      evidence,
      severity: "HIGH",
    };
  }

  const exchange = input.sections.exchangeResponse;
  if (exchange?.closeFailed === true) {
    push("Close attempt failed on exchange.");
    return {
      category: "CLOSE_FAILED",
      headline: "Position close failed",
      detail: "The system attempted to close but the exchange response indicates failure.",
      evidence,
      severity: "HIGH",
    };
  }

  if (exchange?.status === "FAILED") {
    push(`Exchange journal status: ${String(exchange.status)}`);
    return {
      category: "EXECUTION_FAILED",
      headline: "Order execution failed",
      detail: "Binance testnet journal marks this trade as FAILED.",
      evidence,
      severity: "HIGH",
    };
  }

  for (const entry of input.timeline) {
    if (entry.section === "EXCHANGE_RESPONSE" && entry.hasError) {
      push(entry.error ?? entry.summary);
      return {
        category: "EXCHANGE_ERROR",
        headline: "Exchange returned an error",
        detail: entry.error ?? "Exchange response contained an error payload.",
        evidence,
        severity: "MEDIUM",
      };
    }
    if (entry.section === "POSITION_UPDATES" && entry.hasError) {
      push(entry.error ?? entry.summary);
      return {
        category: "MONITOR_ERROR",
        headline: "Monitor reported an error during the trade",
        detail: entry.error ?? "Testnet monitor logged an error for this trade.",
        evidence,
        severity: "MEDIUM",
      };
    }
  }

  const timelineErr = firstError(input.timeline);
  if (timelineErr && input.outcomeStatus === "FAILED") {
    push(timelineErr);
    return {
      category: "UNKNOWN",
      headline: "Trade failed — cause unclear",
      detail: timelineErr,
      evidence,
      severity: "MEDIUM",
    };
  }

  if (input.outcomeStatus === "BLOCKED") {
    return {
      category: "RISK_BLOCKED",
      headline: "Trade was blocked",
      detail: "Trade did not complete — inspect risk checks and preview blockers.",
      evidence,
      severity: "MEDIUM",
    };
  }

  return {
    category: "NONE",
    headline: "No failure detected",
    detail:
      input.outcomeStatus === "CLOSED"
        ? "Trade lifecycle completed without recorded hard failures."
        : "Trade is open or incomplete — no terminal failure recorded yet.",
    evidence,
    severity: "NONE",
  };
}

export function failureCategoryLabel(category: BlackBoxFailureCategory): string {
  const labels: Record<BlackBoxFailureCategory, string> = {
    NONE: "No failure",
    RISK_BLOCKED: "Risk blocked",
    PREVIEW_BLOCKED: "Preview blocked",
    AI_VETO: "AI veto",
    EXECUTION_FAILED: "Execution failed",
    EXCHANGE_ERROR: "Exchange error",
    CLOSE_FAILED: "Close failed",
    MONITOR_ERROR: "Monitor error",
    UNKNOWN: "Unknown",
  };
  return labels[category];
}
