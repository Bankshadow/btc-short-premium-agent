import {
  AUTOMATION_SAFETY_NOTICE,
  backoffMinutesForFailures,
  DEFAULT_AUTOMATION_JOBS,
} from "./config";
import { normalizeCronIntervalMinutes } from "./cron-config";
import { handleAutomationJobFailure } from "./failure-actions";
import { runAutomationJob } from "./run-job";
import { loadAutomationServerContext } from "./server-context";
import { AUTOMATION_GUARANTEES } from "./safety";
import {
  appendAutomationHistory,
  appendFailedAutomationJob,
  loadAutomationState,
  loadFailedAutomationJobs,
  loadRecentIdempotencyKeys,
  loadServerPendingOperatorActions,
  mergeServerPendingOperatorActions,
  recordIdempotencyKey,
  removeFailedAutomationJob,
  saveAutomationState,
} from "./state-store";
import type {
  AutomationFailedJob,
  AutomationJob,
  AutomationJobType,
  AutomationRun,
  AutomationRunInput,
  AutomationStatusSnapshot,
} from "./types";

function newRunId(): string {
  return `acp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newFailedJobId(): string {
  return `acpf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildIdempotencyKey(
  workspaceId: string,
  trigger: string,
  jobs: AutomationJobType[],
): string {
  const bucket = Math.floor(Date.now() / (10 * 60_000));
  return `${workspaceId}:${trigger}:${jobs.join(",")}:${bucket}`;
}

function resolveJobs(
  input: AutomationRunInput,
  toggles: Record<AutomationJobType, boolean>,
): AutomationJobType[] {
  const requested = input.jobs?.length ? input.jobs : DEFAULT_AUTOMATION_JOBS;
  return requested.filter((j) => toggles[j] !== false);
}

function finalizeRunStatus(
  jobs: AutomationJob[],
  blocked: boolean,
): AutomationRun["status"] {
  if (blocked) return "BLOCKED";
  if (jobs.some((j) => j.status === "FAILED")) return "FAILED";
  if (jobs.every((j) => j.status === "SKIPPED")) return "SKIPPED";
  return "SUCCESS";
}

async function isDuplicateRun(key: string): Promise<boolean> {
  const keys = await loadRecentIdempotencyKeys();
  return keys.includes(key);
}

async function acquireRunLock(
  runId: string,
  workspaceId: string,
): Promise<{ acquired: boolean; reason?: string }> {
  const state = await loadAutomationState(workspaceId);
  const now = Date.now();
  if (state.lock.held && state.lock.expiresAt) {
    const expires = new Date(state.lock.expiresAt).getTime();
    if (expires > now) {
      return {
        acquired: false,
        reason: "Automation run lock held — duplicate prevented.",
      };
    }
  }
  const acquiredAt = new Date().toISOString();
  const expiresAt = new Date(now + 5 * 60_000).toISOString();
  state.lock = { held: true, runId, acquiredAt, expiresAt };
  await saveAutomationState(state);
  return { acquired: true };
}

async function releaseRunLock(runId: string, workspaceId: string): Promise<void> {
  const state = await loadAutomationState(workspaceId);
  if (state.lock.runId === runId) {
    state.lock = { held: false, runId: null, acquiredAt: null, expiresAt: null };
    await saveAutomationState(state);
  }
}

function isJobInBackoff(
  jobType: AutomationJobType,
  consecutiveFailures: Partial<Record<AutomationJobType, number>>,
  failedJobs: AutomationFailedJob[],
  force?: boolean,
): boolean {
  if (force) return false;
  const count = consecutiveFailures[jobType] ?? 0;
  if (count <= 0) return false;
  const latest = failedJobs.find((f) => f.jobType === jobType);
  if (!latest?.backoffUntil) return false;
  return new Date(latest.backoffUntil).getTime() > Date.now();
}

export async function runAutomationCycle(
  input: AutomationRunInput = {},
): Promise<AutomationRun> {
  const workspaceId = input.workspaceId ?? "server-default";
  const runId = newRunId();
  const startedAt = new Date().toISOString();
  const trigger = input.trigger ?? "manual";
  const state = await loadAutomationState(workspaceId);

  if (state.settings.paused && !input.force) {
    return {
      runId,
      workspaceId,
      status: "SKIPPED",
      trigger,
      idempotencyKey: input.idempotencyKey ?? buildIdempotencyKey(workspaceId, trigger, []),
      startedAt,
      completedAt: new Date().toISOString(),
      jobs: [],
      errors: ["Automation paused by operator."],
      nextRunAt: state.nextRunAt,
      linkedRunId: null,
      safetyNotice: AUTOMATION_SAFETY_NOTICE,
      ...AUTOMATION_GUARANTEES,
      analyze: null,
      autopilotResult: null,
    };
  }

  if (!state.settings.automationEnabled && !input.force) {
    return {
      runId,
      workspaceId,
      status: "SKIPPED",
      trigger,
      idempotencyKey: input.idempotencyKey ?? buildIdempotencyKey(workspaceId, trigger, []),
      startedAt,
      completedAt: new Date().toISOString(),
      jobs: [],
      errors: ["Automation disabled in settings."],
      nextRunAt: state.nextRunAt,
      linkedRunId: null,
      safetyNotice: AUTOMATION_SAFETY_NOTICE,
      ...AUTOMATION_GUARANTEES,
      analyze: null,
      autopilotResult: null,
    };
  }

  const jobsToRun = resolveJobs(input, state.settings.moduleToggles);
  const idempotencyKey =
    input.idempotencyKey ?? buildIdempotencyKey(workspaceId, trigger, jobsToRun);

  if (!input.force && (await isDuplicateRun(idempotencyKey))) {
    return {
      runId,
      workspaceId,
      status: "SKIPPED",
      trigger,
      idempotencyKey,
      startedAt,
      completedAt: new Date().toISOString(),
      jobs: [],
      errors: ["Duplicate run skipped (idempotency)."],
      nextRunAt: state.nextRunAt,
      linkedRunId: null,
      safetyNotice: AUTOMATION_SAFETY_NOTICE,
      ...AUTOMATION_GUARANTEES,
      analyze: null,
      autopilotResult: null,
    };
  }

  const lock = await acquireRunLock(runId, workspaceId);
  if (!lock.acquired) {
    return {
      runId,
      workspaceId,
      status: "SKIPPED",
      trigger,
      idempotencyKey,
      startedAt,
      completedAt: new Date().toISOString(),
      jobs: [],
      errors: [lock.reason ?? "Lock not acquired."],
      nextRunAt: state.nextRunAt,
      linkedRunId: null,
      safetyNotice: AUTOMATION_SAFETY_NOTICE,
      ...AUTOMATION_GUARANTEES,
      analyze: null,
      autopilotResult: null,
    };
  }

  const server = await loadAutomationServerContext(input);
  const failedJobs = await loadFailedAutomationJobs();
  const jobResults: AutomationJob[] = [];
  const errors: string[] = [];
  let blocked = false;

  if (!input.force) {
    const { runPreCycleLoopCheck } = await import(
      "@/lib/autopilot-loop-guard/run-guard"
    );
    const loopCheck = await runPreCycleLoopCheck(workspaceId);
    if (loopCheck.blocked) {
      if (loopCheck.operatorAction) {
        await mergeServerPendingOperatorActions([loopCheck.operatorAction]);
      }
      const { emitAiStatusEvent } = await import("@/lib/ai-status/event-store");
      await emitAiStatusEvent({
        type: "PERMISSION_REQUESTED",
        runId,
        detail: loopCheck.decision.reason,
        technical: `loop-guard:${loopCheck.decision.level}`,
      });
      await releaseRunLock(runId, workspaceId);
      return {
        runId,
        workspaceId,
        status: "BLOCKED",
        trigger,
        idempotencyKey,
        startedAt,
        completedAt: new Date().toISOString(),
        jobs: [],
        errors: [loopCheck.decision.reason],
        nextRunAt: state.nextRunAt,
        linkedRunId: null,
        safetyNotice: AUTOMATION_SAFETY_NOTICE,
        ...AUTOMATION_GUARANTEES,
        analyze: null,
        autopilotResult: null,
      };
    }
  }

  const ctx = {
    runId,
    workspaceId,
    input,
    server,
    analyze: null as AutomationRun["analyze"],
    autopilotResult: null as AutomationRun["autopilotResult"],
    backboneHealth: null,
  };

  try {
    for (const jobType of jobsToRun) {
      const lockKey = `${workspaceId}:${jobType}`;
      const existingLock = state.jobLocks[lockKey];
      if (
        existingLock &&
        new Date(existingLock.expiresAt).getTime() > Date.now() &&
        !input.force
      ) {
        jobResults.push({
          jobId: `aj-${jobType}-${runId}`,
          workspaceId,
          jobType,
          status: "SKIPPED",
          idempotencyKey: `${workspaceId}:${jobType}:${runId}`,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          resultSummary: "Job type locked — duplicate prevented.",
          error: null,
          linkedRunId: runId,
        });
        continue;
      }

      if (
        isJobInBackoff(
          jobType,
          state.consecutiveFailures,
          failedJobs,
          input.force,
        )
      ) {
        jobResults.push({
          jobId: `aj-${jobType}-${runId}`,
          workspaceId,
          jobType,
          status: "SKIPPED",
          idempotencyKey: `${workspaceId}:${jobType}:${runId}`,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          resultSummary: "Skipped — backoff after repeated failures.",
          error: null,
          linkedRunId: runId,
        });
        continue;
      }

      state.jobLocks[lockKey] = {
        runId,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      };
      await saveAutomationState(state);

      const result = await runAutomationJob(jobType, ctx);
      jobResults.push(result);

      delete state.jobLocks[lockKey];

      if (result.status === "FAILED" && result.error) {
        errors.push(`${jobType}: ${result.error}`);
        const prev = state.consecutiveFailures[jobType] ?? 0;
        const nextCount = prev + 1;
        state.consecutiveFailures[jobType] = nextCount;
        const backoffMin = backoffMinutesForFailures(nextCount);
        const failed: AutomationFailedJob = {
          failedJobId: newFailedJobId(),
          runId,
          workspaceId,
          jobType,
          jobId: result.jobId,
          idempotencyKey: result.idempotencyKey,
          error: result.error,
          failedAt: new Date().toISOString(),
          retryCount: 0,
          backoffUntil:
            backoffMin > 0
              ? new Date(Date.now() + backoffMin * 60_000).toISOString()
              : null,
          input,
        };
        await appendFailedAutomationJob(failed);
        await handleAutomationJobFailure(failed, server);
        if (jobType === "DESK_ANALYZE") blocked = true;
      } else if (result.status === "SUCCESS") {
        state.consecutiveFailures[jobType] = 0;
      } else if (result.status === "BLOCKED") {
        blocked = true;
      }
    }
  } finally {
    await releaseRunLock(runId, workspaceId);
  }

  const intervalMinutes = state.settings.intervalMinutes ?? 15;
  const nextRunAt = new Date(
    Date.now() + normalizeCronIntervalMinutes(intervalMinutes) * 60_000,
  ).toISOString();
  const status = finalizeRunStatus(jobResults, blocked);
  const completedAt = new Date().toISOString();

  const run: AutomationRun = {
    runId,
    workspaceId,
    status,
    trigger,
    idempotencyKey,
    startedAt,
    completedAt,
    jobs: jobResults,
    errors,
    nextRunAt,
    linkedRunId: ctx.autopilotResult?.runId ?? null,
    safetyNotice: AUTOMATION_SAFETY_NOTICE,
    ...AUTOMATION_GUARANTEES,
    analyze: ctx.analyze,
    autopilotResult: ctx.autopilotResult,
  };

  state.lastRun = run;
  if (status === "SUCCESS") state.lastSuccessfulRunAt = completedAt;
  state.nextRunAt = nextRunAt;
  state.settings.lastRunAt = completedAt;
  state.settings.nextRunAt = nextRunAt;
  await saveAutomationState(state);
  await appendAutomationHistory(run);
  await recordIdempotencyKey(idempotencyKey);

  try {
    const { emitMissionAlert } = await import("@/lib/mission-notifications/emit-mission-alert");
    const verdict =
      run.autopilotResult?.finalVerdict ??
      run.analyze?.tradingDesk?.weightedCommittee?.weightedVerdict ??
      run.analyze?.step5_verdict?.recommendation ??
      "—";
    void emitMissionAlert({
      kind: "automation_cycle",
      title: `Autopilot cycle ${status}`,
      body: `Trigger ${trigger} · verdict ${verdict} · ${run.jobs.length} jobs`,
    });
  } catch {
    /* alerts are best-effort */
  }

  try {
    const { buildObservabilitySnapshot } = await import("@/lib/observability");
    await buildObservabilitySnapshot(workspaceId, { promoteIncidents: true });
  } catch {
    /* observability refresh is best-effort */
  }

  try {
    const { syncTelegramControlChannel, isTelegramControlEnabled } = await import(
      "@/lib/telegram-control-channel"
    );
    if (isTelegramControlEnabled()) {
      void syncTelegramControlChannel({ workspaceId, sendPermissionPrompt: true });
    }
  } catch {
    /* telegram control sync is best-effort */
  }

  try {
    const { evaluateMissionController, applyMissionControllerRiskAdjustment } = await import(
      "@/lib/mission-controller"
    );
    const controller = await evaluateMissionController();
    await applyMissionControllerRiskAdjustment(controller);
  } catch {
    /* mission controller risk adjust is best-effort */
  }

  return run;
}

export async function retryAutomationJob(
  failedJobId: string,
): Promise<AutomationRun | null> {
  const failed = (await loadFailedAutomationJobs()).find(
    (f) => f.failedJobId === failedJobId,
  );
  if (!failed) return null;

  const result = await runAutomationCycle({
    ...failed.input,
    jobs: [failed.jobType],
    force: true,
    trigger: "retry",
    idempotencyKey: `${failed.idempotencyKey}:retry:${Date.now()}`,
  });

  if (result.status !== "FAILED") {
    await removeFailedAutomationJob(failedJobId);
  }
  return result;
}

export async function pauseAutomation(
  paused: boolean,
  workspaceId = "server-default",
): Promise<void> {
  const state = await loadAutomationState(workspaceId);
  state.settings.paused = paused;
  await saveAutomationState(state);
}

export async function getAutomationStatus(
  workspaceId = "server-default",
): Promise<AutomationStatusSnapshot> {
  const state = await loadAutomationState(workspaceId);
  const failedJobs = await loadFailedAutomationJobs();
  const pendingOperatorActions = await loadServerPendingOperatorActions();
  const activeJobs =
    state.lastRun?.status === "RUNNING"
      ? state.lastRun.jobs.filter((j) => j.status === "RUNNING")
      : [];

  return { state, activeJobs, failedJobs, pendingOperatorActions };
}
