import type { PlatformHealthReport } from "./types";
import {
  createObservabilityIncident,
  loadObservabilityIncidents,
} from "./store";

export async function promoteCriticalFailures(
  report: PlatformHealthReport,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const existing = await loadObservabilityIncidents();
  const openDescriptions = new Set(
    existing
      .filter((i) => i.status === "open" || i.status === "investigating")
      .map((i) => i.description.slice(0, 80)),
  );

  async function maybeCreate(input: {
    description: string;
    type: "data_failure" | "risk_breach" | "alert_failure" | "other";
    severity: "high" | "critical";
    rootCause: string;
    correctiveAction: string;
    links?: Parameters<typeof createObservabilityIncident>[0]["links"];
  }) {
    const key = input.description.slice(0, 80);
    if (openDescriptions.has(key)) {
      skipped.push(key);
      return;
    }
    const inc = await createObservabilityIncident({
      workspaceId: report.workspaceId,
      type: input.type,
      severity: input.severity,
      description: input.description,
      rootCause: input.rootCause,
      correctiveAction: input.correctiveAction,
      autoCreated: true,
      links: input.links,
    });
    openDescriptions.add(key);
    created.push(inc.id);
  }

  if (report.signals.database.liveExecutionBlocked) {
    await maybeCreate({
      description: `Database health critical: ${report.signals.database.liveBlockReason ?? "live writes blocked"}`,
      type: "data_failure",
      severity: "critical",
      rootCause: "Warehouse write health failure",
      correctiveAction: "Review /admin/health and /warehouse write health domains.",
    });
  }

  if (
    report.dimensions.find((d) => d.dimension === "risk")?.level === "CRITICAL"
  ) {
    await maybeCreate({
      description: `Critical trading risk: ${report.signals.liveBlockers[0] ?? "risk gates failing"}`,
      type: "risk_breach",
      severity: "critical",
      rootCause: "Observability risk dimension CRITICAL",
      correctiveAction: "Resolve blockers on /command-center and /policies.",
    });
  }

  if (
    report.signals.alerts.recentDeliveryFailures > 0 &&
    !report.signals.alerts.anyChannelConfigured
  ) {
    await maybeCreate({
      description: "Alert delivery failed — no channels configured",
      type: "alert_failure",
      severity: "high",
      rootCause: "Missing Telegram, Discord, or desk webhook",
      correctiveAction: "Configure alert channels in environment or desk settings.",
    });
  } else if (report.signals.alerts.recentDeliveryFailures >= 3) {
    await maybeCreate({
      description: `Alert delivery failures: ${report.signals.alerts.recentDeliveryFailures} recent`,
      type: "alert_failure",
      severity: "high",
      rootCause: "External briefing dispatch failures",
      correctiveAction: "Check /admin/integrations and notification logs.",
    });
  }

  for (const job of report.signals.failedJobs.filter((j) => j.retryCount >= 2).slice(0, 2)) {
    await maybeCreate({
      description: `Automation job failed repeatedly: ${job.jobType}`,
      type: "data_failure",
      severity: "high",
      rootCause: job.error,
      correctiveAction: "Retry from /admin/jobs or /automation-control.",
      links: { failedJobId: job.failedJobId, jobId: job.jobType },
    });
  }

  if (!report.signals.exchange.connected && report.signals.exchange.configured) {
    await maybeCreate({
      description: `Exchange disconnected: ${report.signals.exchange.error ?? "auth ping failed"}`,
      type: "data_failure",
      severity: "high",
      rootCause: "Exchange connectivity failure",
      correctiveAction: "Verify API keys and network on /admin/integrations.",
    });
  }

  return { created, skipped };
}
