import type { MissionFlowStrategyHealth } from "@/lib/mission-flow/types";
import type {
  IntegratedStrategyHealthSnapshot,
  StrategyHealthReport,
} from "./types";

export function mapIntegratedReportToMissionHealth(
  report: StrategyHealthReport,
): MissionFlowStrategyHealth {
  const tradeBlocked =
    report.status === "PAUSE" || report.status === "REJECT";
  return {
    strategyId: report.strategyTag,
    label: report.strategyTag,
    status: report.status,
    recommendation: report.recommendation,
    winRate: report.winRate,
    sampleSize: report.evidenceCount,
    healthScorePct: null,
    tradeAllowed: !tradeBlocked,
    blockReason: tradeBlocked ? report.recommendation : null,
  };
}

export function resolveMissionStrategyHealthFromIntegrated(
  integrated: IntegratedStrategyHealthSnapshot | null | undefined,
  fallback: MissionFlowStrategyHealth | null,
): MissionFlowStrategyHealth | null {
  if (integrated?.primaryReport) {
    return mapIntegratedReportToMissionHealth(integrated.primaryReport);
  }
  return fallback;
}

export function resolveAiNextActionFromIntegrated(
  integrated: IntegratedStrategyHealthSnapshot | null | undefined,
  fallback: string,
): string {
  const report = integrated?.primaryReport;
  if (!report) return fallback;
  if (!integrated?.evidenceReady) {
    return report.nextAction;
  }
  if (report.status === "PAUSE" || report.status === "REJECT") {
    return report.nextAction;
  }
  if (report.status === "REDUCE_RISK") {
    return report.nextAction;
  }
  if (report.status === "CONTINUE" && integrated.evidenceReady) {
    return report.nextAction;
  }
  return report.nextAction || fallback;
}
