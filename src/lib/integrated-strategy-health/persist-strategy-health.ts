import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { upsertAnomalyFindings } from "@/lib/anomaly-detection/store";
import type { AnomalyFinding } from "@/lib/anomaly-detection/types";
import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import type {
  StrategyHealthReport,
  StrategyRegistryHealthRecommendation,
} from "./types";

const REGISTRY_RECOMMENDATIONS_FILE = "strategy-health-recommendations.json";
const LAST_REVIEW_FILE = "strategy-health-last-review.json";

export async function loadRegistryHealthRecommendations(): Promise<
  StrategyRegistryHealthRecommendation[]
> {
  const parsed = await readCronJsonFile(
    REGISTRY_RECOMMENDATIONS_FILE,
    [] as StrategyRegistryHealthRecommendation[],
  );
  return Array.isArray(parsed) ? parsed : [];
}

async function saveRegistryRecommendation(
  rec: StrategyRegistryHealthRecommendation,
): Promise<void> {
  const existing = await loadRegistryHealthRecommendations();
  const next = [
    rec,
    ...existing.filter((r) => r.strategyTag !== rec.strategyTag),
  ].slice(0, 20);
  await writeCronJsonFile(REGISTRY_RECOMMENDATIONS_FILE, next);
}

async function loadLastReviewFingerprint(): Promise<string | null> {
  const parsed = await readCronJsonFile<{ fingerprint: string }>(
    LAST_REVIEW_FILE,
    { fingerprint: "" },
  );
  return parsed?.fingerprint || null;
}

async function saveLastReviewFingerprint(fingerprint: string): Promise<void> {
  await writeCronJsonFile(LAST_REVIEW_FILE, {
    fingerprint,
    updatedAt: new Date().toISOString(),
  });
}

function reviewFingerprint(report: StrategyHealthReport): string {
  return `${report.strategyTag}:${report.status}:${report.evidenceCount}:${report.winRate}:${report.netPnl}`;
}

function buildGovernanceFinding(
  report: StrategyHealthReport,
): AnomalyFinding | null {
  if (report.status !== "PAUSE" && report.status !== "REJECT") return null;
  return {
    anomalyType: "strategy_health_governance",
    severity: report.status === "REJECT" ? "CRITICAL" : "WARNING",
    title: `Strategy health ${report.status}: ${report.strategyTag}`,
    evidence: {
      strategyTag: report.strategyTag,
      status: report.status,
      winRate: report.winRate,
      profitFactor: report.profitFactor,
      evidenceCount: report.evidenceCount,
      recommendation: report.recommendation,
    },
    impactedModules: [
      "Strategy Registry",
      "Testnet Autoexec",
      "Governance",
    ],
    recommendedAction: report.nextAction,
    fingerprint: `strategy-health:${report.strategyTag}:${report.status}`.slice(
      0,
      240,
    ),
  };
}

export async function applyIntegratedStrategyHealthSideEffects(input: {
  report: StrategyHealthReport;
}): Promise<{
  registryWritten: boolean;
  journalWritten: boolean;
  governanceCreated: boolean;
}> {
  const fp = reviewFingerprint(input.report);
  const lastFp = await loadLastReviewFingerprint();
  if (lastFp === fp) {
    return {
      registryWritten: false,
      journalWritten: false,
      governanceCreated: false,
    };
  }

  const registryRec: StrategyRegistryHealthRecommendation = {
    strategyTag: input.report.strategyTag,
    status: input.report.status,
    recommendation: input.report.recommendation,
    nextAction: input.report.nextAction,
    reportId: input.report.reportId,
    reviewedAt: input.report.reviewedAt,
    advisoryOnly: true,
  };
  await saveRegistryRecommendation(registryRec);

  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "STRATEGY_HEALTH_REVIEWED",
    symbol: null,
    decisionLogId: input.report.linkedDecisionIds[0] ?? null,
    orderId: null,
    positionId: null,
    payload: {
      reportId: input.report.reportId,
      strategyTag: input.report.strategyTag,
      status: input.report.status,
      evidenceCount: input.report.evidenceCount,
      winRate: input.report.winRate,
      profitFactor: input.report.profitFactor,
      recommendation: input.report.recommendation,
      linkedTradeIds: input.report.linkedTradeIds,
      linkedLearningRecordIds: input.report.linkedLearningRecordIds,
      advisoryOnly: true,
    },
  });

  const finding = buildGovernanceFinding(input.report);
  if (finding) {
    await upsertAnomalyFindings([finding]);
  }

  await saveLastReviewFingerprint(fp);

  return {
    registryWritten: true,
    journalWritten: true,
    governanceCreated: Boolean(finding),
  };
}
