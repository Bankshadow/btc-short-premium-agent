import type { StrategistAgentInput } from "./types";

export interface TradingSystemsArchitectResult {
  technicalDiagnosis: string;
  tradingReadinessDiagnosis: string;
  automationDiagnosis: string;
  architectureRisks: string[];
}

export function runTradingSystemsArchitectAgent(
  input: StrategistAgentInput,
): TradingSystemsArchitectResult {
  const monitor = input.context.latestTestnetMonitor;
  const automation = input.context.latestAutomationStatus;
  const architectureRisks: string[] = [];

  if (!monitor?.connected) {
    architectureRisks.push("Execution telemetry loop is disconnected from daily readiness path.");
  }
  if ((monitor?.mismatches ?? []).length > 0) {
    architectureRisks.push("Position/journal mismatch can distort operational confidence.");
  }
  if (!automation?.state.lastRun) {
    architectureRisks.push("Automation has no trusted server-side run history.");
  }
  if ((automation?.failedJobs ?? []).length > 0) {
    architectureRisks.push("Automation failure backlog can silently delay critical maintenance loops.");
  }

  const technicalDiagnosis =
    architectureRisks.length > 0
      ? "Core systems are in place, but operational coherence needs hardening across monitor, automation, and diagnostics."
      : "Core systems and telemetry loops are consistent for testnet-first operation.";
  const tradingReadinessDiagnosis = monitor?.connected
    ? "Testnet execution readiness is active and aligned with safety constraints."
    : "Trading readiness remains constrained by monitor/exchange connectivity or telemetry mismatch.";
  const automationDiagnosis = automation?.state.settings.automationEnabled
    ? "Automation engine enabled; prioritize reducing noise and failure backlog."
    : "Automation engine disabled or effectively inactive.";

  return {
    technicalDiagnosis,
    tradingReadinessDiagnosis,
    automationDiagnosis,
    architectureRisks,
  };
}
