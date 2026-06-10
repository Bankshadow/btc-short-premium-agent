import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { upsertAnomalyFindings } from "@/lib/anomaly-detection/store";
import type { AnomalyFinding } from "@/lib/anomaly-detection/types";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import type { RiskBudgetAnalysis, RiskBudgetRecommendation } from "./types";

const AUDIT_FILE = "integrated-risk-budget-audit.json";
const LAST_FINGERPRINT_FILE = "integrated-risk-budget-last.json";

interface RiskBudgetAuditEntry {
  id: string;
  recommendationId: string;
  mode: string;
  recommendedMaxNotional: number;
  recordedAt: string;
}

async function appendAudit(entry: RiskBudgetAuditEntry): Promise<void> {
  const existing = await readCronJsonFile<RiskBudgetAuditEntry[]>(AUDIT_FILE, []);
  const list = Array.isArray(existing) ? existing : [];
  await writeCronJsonFile(AUDIT_FILE, [entry, ...list].slice(0, 100));
}

function fingerprint(rec: RiskBudgetRecommendation): string {
  return `${rec.mode}:${rec.recommendedMaxNotional}:${rec.recommendedRiskPerTrade}:${rec.recommendedMaxOpenPositions}`;
}

function buildGovernanceFinding(
  rec: RiskBudgetRecommendation,
  analysis: RiskBudgetAnalysis,
): AnomalyFinding | null {
  if (!analysis.governanceWarningRecommended) return null;
  if (rec.mode !== "COOLDOWN" && rec.mode !== "DEFENSIVE") return null;
  return {
    anomalyType: "risk_budget_governance",
    severity: rec.mode === "COOLDOWN" ? "WARNING" : "INFO",
    title: `Risk budget ${rec.mode} — reduce testnet exposure`,
    evidence: {
      mode: rec.mode,
      recommendedMaxNotional: rec.recommendedMaxNotional,
      currentMaxNotional: rec.currentMaxNotional,
      reasons: rec.reasons.slice(0, 5),
    },
    impactedModules: ["Risk Manager", "Governance", "Testnet Autoexec"],
    recommendedAction: rec.reasons[0] ?? "Review risk budget recommendation in Settings.",
    fingerprint: `risk-budget:${rec.mode}:${rec.recommendedMaxNotional}`.slice(0, 240),
  };
}

export async function persistRiskBudgetRecommendedSideEffects(input: {
  recommendation: RiskBudgetRecommendation;
  analysis: RiskBudgetAnalysis;
}): Promise<{ journalWritten: boolean; governanceCreated: boolean }> {
  const fp = fingerprint(input.recommendation);
  const last = await readCronJsonFile<{ fingerprint: string }>(LAST_FINGERPRINT_FILE, {
    fingerprint: "",
  });
  if (last?.fingerprint === fp) {
    return { journalWritten: false, governanceCreated: false };
  }

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "RISK_BUDGET_RECOMMENDED",
    symbol: null,
    decisionLogId: null,
    orderId: null,
    positionId: null,
    payload: {
      recommendationId: input.recommendation.recommendationId,
      mode: input.recommendation.mode,
      recommendedMaxNotional: input.recommendation.recommendedMaxNotional,
      recommendedRiskPerTrade: input.recommendation.recommendedRiskPerTrade,
      recommendedDailyLossLimit: input.recommendation.recommendedDailyLossLimit,
      recommendedMaxOpenPositions: input.recommendation.recommendedMaxOpenPositions,
      requiresApproval: true,
      reasons: input.recommendation.reasons.slice(0, 6),
    },
  });

  await appendAudit({
    id: `irb-audit-${Date.now()}`,
    recommendationId: input.recommendation.recommendationId,
    mode: input.recommendation.mode,
    recommendedMaxNotional: input.recommendation.recommendedMaxNotional,
    recordedAt: new Date().toISOString(),
  });

  const finding = buildGovernanceFinding(input.recommendation, input.analysis);
  if (finding) {
    await upsertAnomalyFindings([finding]);
  }

  await writeCronJsonFile(LAST_FINGERPRINT_FILE, {
    fingerprint: fp,
    updatedAt: new Date().toISOString(),
  });

  return { journalWritten: true, governanceCreated: Boolean(finding) };
}
