import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import type { ConfidenceCalibrationReport } from "./types";

const AUDIT_FILE = "integrated-confidence-calibration-audit.json";

export interface CalibrationAuditEntry {
  id: string;
  reportId: string;
  sampleCount: number;
  overconfidenceDetected: boolean;
  underconfidenceDetected: boolean;
  recommendedSizeMultiplier: number;
  recommendation: string;
  recordedAt: string;
}

async function appendAudit(entry: CalibrationAuditEntry): Promise<void> {
  const existing = await readCronJsonFile<CalibrationAuditEntry[]>(AUDIT_FILE, []);
  const list = Array.isArray(existing) ? existing : [];
  await writeCronJsonFile(AUDIT_FILE, [entry, ...list].slice(0, 100));
}

export async function persistConfidenceCalibratedSideEffects(input: {
  report: ConfidenceCalibrationReport;
  symbol?: string | null;
}): Promise<{ journalWritten: boolean; auditWritten: boolean }> {
  if (input.report.sampleCount === 0) {
    return { journalWritten: false, auditWritten: false };
  }

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "CONFIDENCE_CALIBRATED",
    symbol: input.symbol ?? null,
    decisionLogId: null,
    orderId: null,
    positionId: null,
    payload: {
      reportId: input.report.reportId,
      sampleCount: input.report.sampleCount,
      overconfidenceDetected: input.report.overconfidenceDetected,
      underconfidenceDetected: input.report.underconfidenceDetected,
      recommendedSizeMultiplier: input.report.recommendedSizeMultiplier,
      recommendation: input.report.confidenceAdjustmentRecommendation,
      affectedAgents: input.report.affectedAgents.slice(0, 5).map((a) => a.agentName),
      affectedStrategies: input.report.affectedStrategies
        .slice(0, 5)
        .map((s) => s.strategyTag),
    },
  });

  await appendAudit({
    id: `icc-audit-${Date.now()}`,
    reportId: input.report.reportId,
    sampleCount: input.report.sampleCount,
    overconfidenceDetected: input.report.overconfidenceDetected,
    underconfidenceDetected: input.report.underconfidenceDetected,
    recommendedSizeMultiplier: input.report.recommendedSizeMultiplier,
    recommendation: input.report.confidenceAdjustmentRecommendation,
    recordedAt: new Date().toISOString(),
  });

  return { journalWritten: true, auditWritten: true };
}
