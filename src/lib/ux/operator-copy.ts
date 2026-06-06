import type { AutopilotModuleResult } from "@/lib/autopilot/types";

export function formatVerdictLabel(verdict: string): string {
  const v = String(verdict).toUpperCase();
  if (v === "TRADE") return "Ready to trade — paper only";
  if (v === "WAIT") return "Wait — conditions unclear";
  if (v === "SKIP") return "Skip — no trade today";
  if (v === "NONE") return "No recommendation yet";
  return verdict;
}

export function formatDeskStatusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "SAFE") return "Desk is healthy — proceed with paper";
  if (s === "CAUTION") return "Review cautions before acting";
  if (s === "BLOCKED") return "Blocked — fix issues before trading";
  if (s === "EMERGENCY") return "Emergency — stop and review now";
  return status;
}

export function formatRiskBlocker(blocker: string): string {
  return blocker
    .replace(/riskVeto/gi, "risk veto")
    .replace(/preMortem/gi, "pre-mortem")
    .replace(/dataTrust/gi, "data trust")
    .replace(/killSwitch/gi, "kill switch");
}

export function formatLiveReadinessLabel(input: {
  status?: string;
  readyForPilot?: boolean;
  blockers?: string[];
}): string {
  if (input.readyForPilot) return "Ready for small live perp pilot";
  const blocker = input.blockers?.[0];
  if (blocker) return blocker;
  const s = (input.status ?? "UNKNOWN").toUpperCase();
  if (s === "PASS") return "Paper learning on track";
  if (s === "WARNING") return "Gaps remain before live pilot";
  if (s === "FAIL") return "Not ready for live — resolve blockers";
  return "Run a desk cycle to assess live readiness";
}

export function summarizeWhatAiDid(modules: AutopilotModuleResult[]): string[] {
  return modules
    .filter((m) => m.shouldDisplayToUser || m.status === "ERROR")
    .slice(0, 6)
    .map((m) => {
      if (m.status === "ERROR") {
        return `Something failed during ${friendlyModuleName(m.moduleId)}.`;
      }
      return `${friendlyModuleName(m.moduleId)}: ${m.summary}`;
    });
}

function friendlyModuleName(id: string): string {
  const map: Record<string, string> = {
    analyze: "Market analysis",
    portfolio: "Portfolio check",
    validation: "Strategy validation",
    strategy_registry: "Strategy registry",
    learning: "Learning update",
    action_queue: "Action queue",
    alert_check: "Alert channels",
    sync_check: "Data sync",
    command_center: "Risk & command center",
  };
  return map[id] ?? id.replace(/_/g, " ");
}

export function formatLearningProgress(input: {
  label?: string;
  resolved?: number;
  target?: number;
}): string {
  if (!input.label) return "Resolve paper trades to unlock learning insights.";
  if ((input.resolved ?? 0) === 0) {
    return "Close and resolve a few paper trades to start learning.";
  }
  return input.label;
}

export function formatRecommendedAction(
  title: string | undefined,
  fallback: string,
): string {
  return title ?? fallback;
}

export const COCKPIT_TAGLINE =
  "Your desk at a glance — status, next step, and safety in one place.";

export const ADVANCED_DRAWERS_HINT =
  "Technical details are tucked away below — open only when you need them.";
