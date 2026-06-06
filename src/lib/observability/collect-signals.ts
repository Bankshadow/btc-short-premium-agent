import { isCronSecretConfigured } from "@/lib/cron/cron-auth";
import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import { buildDbStatusReport } from "@/lib/db/warehouse-status";
import {
  getAutomationStatus,
  loadAutomationHistory,
  loadFailedAutomationJobs,
} from "@/lib/automation-control-plane";
import { loadPolicyDecisions } from "@/lib/policy-engine/audit-store";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { loadObservabilityMetrics } from "./store";
import type { ObservabilitySignals } from "./types";

export async function collectObservabilitySignals(
  workspaceId = "server-default",
): Promise<ObservabilitySignals> {
  const now = new Date().toISOString();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  const [exchange, dbStatus, automationStatus, history, failedJobs, policyDecisions, metrics, serverCtx] =
    await Promise.all([
      buildExchangeStatus(),
      buildDbStatusReport(),
      getAutomationStatus(workspaceId),
      loadAutomationHistory(),
      loadFailedAutomationJobs(),
      loadPolicyDecisions(),
      loadObservabilityMetrics(),
      buildCommandCenterServerContext(),
    ]);

  const recentPolicyBlocks = policyDecisions
    .filter((d) => d.decision === "BLOCK")
    .slice(0, 10);

  const policyBlocks1h = policyDecisions.filter(
    (d) =>
      d.decision === "BLOCK" &&
      new Date(d.evaluatedAt).getTime() >= oneHourAgo,
  ).length;

  const consecutiveFailureTypes = Object.entries(
    automationStatus.state.consecutiveFailures ?? {},
  )
    .filter(([, count]) => count >= 2)
    .map(([type]) => type);

  const liveBlockers: string[] = [];
  if (dbStatus.liveExecutionBlocked) {
    liveBlockers.push(dbStatus.liveBlockReason ?? "Warehouse blocks live writes.");
  }
  for (const job of failedJobs.slice(0, 3)) {
    liveBlockers.push(`Failed job ${job.jobType}: ${job.error}`);
  }
  for (const block of recentPolicyBlocks.slice(0, 3)) {
    liveBlockers.push(`Policy ${block.action}: ${block.blockers[0] ?? "BLOCK"}`);
  }
  if (!exchange.connected && exchange.configured) {
    liveBlockers.push(exchange.error ?? "Exchange disconnected.");
  }

  return {
    workspaceId,
    collectedAt: now,
    api: {
      analyzeRouteOk: true,
      cronConfigured: isCronSecretConfigured(),
      lastCheckAt: now,
    },
    exchange: {
      configured: exchange.configured,
      connected: exchange.connected,
      network: exchange.network,
      error: exchange.error ?? null,
      clockSkewMs: exchange.clockSkewMs,
    },
    database: {
      configured: dbStatus.configured,
      backend: dbStatus.backend,
      liveExecutionBlocked: dbStatus.liveExecutionBlocked,
      liveBlockReason: dbStatus.liveBlockReason,
      writeFailures: dbStatus.writeHealth.reduce(
        (s, w) => s + w.consecutiveFailures,
        0,
      ),
    },
    automation: {
      paused: automationStatus.state.settings.paused ?? false,
      failedJobCount: failedJobs.length,
      consecutiveFailureTypes,
      lastRunStatus: automationStatus.state.lastRun?.status ?? null,
      lastRunAt: automationStatus.state.lastRun?.completedAt ?? history[0]?.completedAt ?? null,
    },
    alerts: {
      telegramConfigured: serverCtx.telegramConfigured,
      discordConfigured: serverCtx.discordEnvConfigured,
      deskWebhookConfigured: serverCtx.deskWebhookConfigured,
      anyChannelConfigured:
        serverCtx.telegramConfigured ||
        serverCtx.discordEnvConfigured ||
        serverCtx.deskWebhookConfigured,
      recentDeliveryFailures: metrics.alertDeliveryFailures,
      lastDeliveryAt: metrics.lastAlertDeliveryAt,
    },
    marketData: {
      btcPrice: null,
      dataTrustGrade: null,
      staleWarning: null,
      analysisLatencyMs: metrics.analysisLatencyMs,
      lastAnalysisAt: metrics.lastAnalysisAt,
    },
    errorRate1h: metrics.errorCount1h,
    policyBlocks1h,
    liveBlockers,
    failedJobs: failedJobs.slice(0, 20),
    recentPolicyBlocks,
  };
}
