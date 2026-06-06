import { DEFAULT_WORKER_JOBS, WORKER_SAFETY_NOTICE } from "./config";
import { runAnomalyDetectionSnapshot } from "@/lib/anomaly-detection";
import { buildWorkerIdempotencyKey, isDuplicateWorkerRun } from "./idempotency";
import { acquireWorkerLock, releaseWorkerLock } from "./lock";
import { runWorkerJob } from "./run-jobs";
import {
  appendFailedWorkerJob,
  appendWorkerHistory,
  loadWorkerState,
  patchWorkerSettings,
  removeFailedWorkerJob,
  saveWorkerState,
} from "./state-store";
import {
  evaluateServerBackboneHealth,
  isBackboneBlockingRun,
} from "./server-backbone";
import type {
  WorkerFailedJob,
  WorkerJobType,
  WorkerRunInput,
  WorkerRunResult,
} from "./types";

function newRunId(): string {
  return `wr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newFailedJobId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveJobs(input: WorkerRunInput): WorkerJobType[] {
  return input.jobs?.length ? input.jobs : DEFAULT_WORKER_JOBS;
}

function finalizeStatus(
  jobs: WorkerRunResult["jobs"],
  blocked: boolean,
): WorkerRunResult["status"] {
  if (blocked) return "BLOCKED";
  if (jobs.some((j) => j.status === "ERROR")) return "FAILED";
  if (jobs.every((j) => j.status === "SKIPPED")) return "SKIPPED";
  return "COMPLETED";
}

export async function runWorkerCycle(
  input: WorkerRunInput = {},
): Promise<WorkerRunResult> {
  const runId = newRunId();
  const startedAt = new Date().toISOString();
  const trigger = input.trigger ?? "manual";
  const jobsToRun = resolveJobs(input);
  const idempotencyKey =
    input.idempotencyKey ??
    buildWorkerIdempotencyKey({ trigger, jobs: jobsToRun });

  if (!input.force && (await isDuplicateWorkerRun(idempotencyKey))) {
    const state = await loadWorkerState();
    return {
      runId,
      idempotencyKey,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "SKIPPED",
      trigger,
      jobs: [],
      errors: ["Duplicate run skipped (idempotency)."],
      nextRunAt: state.nextRunAt,
      backboneHealthy: state.lastRun?.backboneHealthy ?? false,
      backboneHealth: state.lastRun?.backboneHealth ?? null,
      autopilotResult: null,
      analyze: null,
      safetyNotice: WORKER_SAFETY_NOTICE,
      cannotPlaceLiveTrades: true,
      cannotApproveProposals: true,
    };
  }

  const lock = await acquireWorkerLock(runId);
  if (!lock.acquired) {
    const state = await loadWorkerState();
    return {
      runId,
      idempotencyKey,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "SKIPPED",
      trigger,
      jobs: [],
      errors: [lock.reason],
      nextRunAt: state.nextRunAt,
      backboneHealthy: state.lastRun?.backboneHealthy ?? false,
      backboneHealth: state.lastRun?.backboneHealth ?? null,
      autopilotResult: null,
      analyze: null,
      safetyNotice: WORKER_SAFETY_NOTICE,
      cannotPlaceLiveTrades: true,
      cannotApproveProposals: true,
    };
  }

  const errors: string[] = [];
  const jobResults: WorkerRunResult["jobs"] = [];
  let blocked = false;

  const backboneEval = await evaluateServerBackboneHealth();
  const ctx = {
    runId,
    input,
    analyze: null as WorkerRunResult["analyze"],
    autopilotResult: null as WorkerRunResult["autopilotResult"],
    backboneHealth: backboneEval.health,
  };

  if (
    !input.force &&
    backboneEval.health &&
    isBackboneBlockingRun(backboneEval.health) &&
    jobsToRun.includes("DESK_ANALYZE_CYCLE")
  ) {
    blocked = true;
    errors.push(
      backboneEval.health.writeBlockers[0] ??
        backboneEval.health.staleWarning ??
        "Data backbone unhealthy.",
    );
    jobResults.push({
      jobType: "DESK_ANALYZE_CYCLE",
      status: "BLOCKED",
      durationMs: 0,
      summary: errors[0] ?? "Blocked by backbone health.",
      idempotencyKey: `DESK_ANALYZE_CYCLE:${runId}`,
    });
  }

  try {
    for (const jobType of jobsToRun) {
      if (blocked && jobType === "DESK_ANALYZE_CYCLE") continue;
      const result = await runWorkerJob(jobType, ctx);
      jobResults.push(result);
      if (result.status === "ERROR" && result.error) {
        errors.push(`${jobType}: ${result.error}`);
        await appendFailedWorkerJob({
          failedJobId: newFailedJobId(),
          runId,
          jobType,
          idempotencyKey: result.idempotencyKey,
          error: result.error,
          failedAt: new Date().toISOString(),
          retryCount: 0,
          input,
        });
      }
    }
  } finally {
    await releaseWorkerLock(runId);
  }

  const intervalMinutes = input.workerSettings?.intervalMinutes ?? 15;
  const nextRunAt = new Date(
    Date.now() + Math.max(intervalMinutes, 5) * 60_000,
  ).toISOString();
  const status = finalizeStatus(jobResults, blocked);
  const completedAt = new Date().toISOString();

  const result: WorkerRunResult = {
    runId,
    idempotencyKey,
    startedAt,
    completedAt,
    status,
    trigger,
    jobs: jobResults,
    errors,
    nextRunAt,
    backboneHealthy: ctx.backboneHealth?.healthy ?? false,
    backboneHealth: ctx.backboneHealth,
    autopilotResult: ctx.autopilotResult,
    analyze: ctx.analyze,
    safetyNotice: WORKER_SAFETY_NOTICE,
    cannotPlaceLiveTrades: true,
    cannotApproveProposals: true,
  };

  const state = await loadWorkerState();
  state.lastRun = result;
  if (status === "COMPLETED") {
    state.lastSuccessfulRunAt = completedAt;
  }
  state.nextRunAt = nextRunAt;
  state.settings.lastRunAt = completedAt;
  state.settings.nextRunAt = nextRunAt;
  await saveWorkerState(state);
  await appendWorkerHistory(result);
  await patchWorkerSettings({
    lastRunAt: completedAt,
    nextRunAt,
  });
  try {
    await runAnomalyDetectionSnapshot({ persist: true, useCache: false });
  } catch {
    // Anomaly refresh is best-effort and must not fail worker completion.
  }

  return result;
}

export async function retryFailedWorkerJob(
  failedJobId: string,
): Promise<WorkerRunResult | null> {
  const { loadFailedWorkerJobs } = await import("./state-store");
  const failed = (await loadFailedWorkerJobs()).find(
    (f) => f.failedJobId === failedJobId,
  );
  if (!failed) return null;

  const result = await runWorkerCycle({
    ...failed.input,
    jobs: [failed.jobType],
    force: true,
    trigger: "retry",
    idempotencyKey: `${failed.idempotencyKey}:retry:${Date.now()}`,
  });

  if (result.status !== "FAILED") {
    await removeFailedWorkerJob(failedJobId);
  }
  return result;
}
