import type { AutomationRun } from "@/lib/automation-control-plane/types";
import type { MissionFlowActivityItem } from "./types";

function resolveVerdict(run: AutomationRun): string | null {
  const verdict =
    run.autopilotResult?.finalVerdict ??
    run.analyze?.tradingDesk?.weightedCommittee?.weightedVerdict ??
    run.analyze?.step5_verdict?.recommendation ??
    null;
  return verdict ? String(verdict).toUpperCase() : null;
}

function summarizeRun(run: AutomationRun): string {
  const tradeJob = run.jobs.find((j) => j.jobType === "BINANCE_TESTNET_AUTOEXECUTE");
  const monitorJob = run.jobs.find((j) => j.jobType === "BINANCE_TESTNET_MONITOR");
  const analyzeJob = run.jobs.find((j) => j.jobType === "DESK_ANALYZE");

  if (monitorJob?.resultSummary?.includes("CLOSED")) {
    return monitorJob.resultSummary;
  }
  if (tradeJob?.resultSummary?.includes("EXECUTED")) {
    return tradeJob.resultSummary;
  }
  if (analyzeJob?.resultSummary) {
    return analyzeJob.resultSummary;
  }
  return run.jobs[0]?.resultSummary ?? run.status;
}

export function buildMissionActivityFromRuns(
  runs: AutomationRun[],
  limit = 8,
): MissionFlowActivityItem[] {
  return runs.slice(0, limit).map((run) => ({
    id: run.runId,
    at: run.completedAt ?? run.startedAt,
    trigger: run.trigger,
    status: run.status,
    summary: summarizeRun(run),
    verdict: resolveVerdict(run),
    jobCount: run.jobs.length,
  }));
}
