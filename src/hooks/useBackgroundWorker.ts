"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadAutopilotSettings } from "@/lib/autopilot/settings-store";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { writeDeskCycle } from "@/lib/data-backbone/write-desk-cycle";
import {
  loadPaperAutopilotSettings,
  resolvePaperAutopilotModeFromAutopilot,
  runPaperAutopilot,
} from "@/lib/paper-autopilot";
import {
  emitFromAutopilotResult,
  emitFromPaperAutopilotResult,
} from "@/lib/smart-briefing/event-helpers";
import {
  loadClientWorkerLastRun,
  loadClientWorkerSettings,
  saveClientWorkerLastRun,
  saveClientWorkerSettings,
} from "@/lib/background-worker/client-settings";
import type { WorkerFailedJob, WorkerRunResult } from "@/lib/background-worker/types";

export function useBackgroundWorker(options?: { enabled?: boolean }) {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<WorkerRunResult | null>(null);
  const [failedJobs, setFailedJobs] = useState<WorkerFailedJob[]>([]);
  const [status, setStatus] = useState<{
    nextRunAt: string | null;
    lastSuccessfulRunAt: string | null;
    backboneHealthy: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/worker/status");
      const data = (await res.json()) as {
        ok: boolean;
        state?: {
          lastRun: WorkerRunResult | null;
          lastSuccessfulRunAt: string | null;
          nextRunAt: string | null;
        };
        failedJobs?: WorkerFailedJob[];
        backboneHealthy?: boolean;
      };
      if (data.ok && data.state) {
        setStatus({
          nextRunAt: data.state.nextRunAt,
          lastSuccessfulRunAt: data.state.lastSuccessfulRunAt,
          backboneHealthy: data.backboneHealthy ?? false,
        });
        if (data.state.lastRun) setLastRun(data.state.lastRun);
        setFailedJobs(data.failedJobs ?? []);
      }
    } catch {
      /* status poll optional */
    }
  }, []);

  useEffect(() => {
    setLastRun(loadClientWorkerLastRun());
    void refreshStatus();
  }, [refreshStatus]);

  const runCycle = useCallback(
    async (opts?: { force?: boolean }) => {
      const settings = loadClientWorkerSettings();
      if (!settings.workerEnabled && !opts?.force) return null;

      setRunning(true);
      setError(null);
      try {
        const autopilotSettings = loadAutopilotSettings();
        const res = await fetch("/api/worker/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: loadDecisionLog(),
            orders: loadPaperOrders(),
            perpPositions: loadPerpPositions(),
            riskProfile: loadDeskSettings().riskProfile,
            settings: autopilotSettings,
            workerSettings: settings,
            force: opts?.force,
            trigger: "client",
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          result?: WorkerRunResult;
          error?: string;
        };
        if (!res.ok || !data.result) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        saveClientWorkerLastRun(data.result);
        setLastRun(data.result);

        const analysis = data.result.analyze;
        const btc = analysis?.step1_marketSnapshot.spotPrice ?? 0;
        const paStored = loadPaperAutopilotSettings();
        const paMode =
          paStored.mode !== "OFF"
            ? paStored.mode
            : resolvePaperAutopilotModeFromAutopilot(autopilotSettings);

        if (paMode !== "OFF" && btc > 0 && analysis) {
          const paResult = runPaperAutopilot({
            data: analysis,
            btcPrice: btc,
            settings: {
              mode: paMode,
              autoResolveEnabled: autopilotSettings.autoResolveEnabled,
            },
          });
          void emitFromPaperAutopilotResult(paResult);
        }

        if (data.result.autopilotResult) {
          void emitFromAutopilotResult(data.result.autopilotResult);
        }

        await writeDeskCycle({ autopilotResult: data.result.autopilotResult ?? undefined });
        saveClientWorkerSettings({
          lastRunAt: data.result.completedAt,
          nextRunAt: data.result.nextRunAt,
        });
        await refreshStatus();
        return data.result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Worker failed";
        setError(msg);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [refreshStatus],
  );

  const retryJob = useCallback(
    async (failedJobId: string) => {
      setRunning(true);
      setError(null);
      try {
        const res = await fetch("/api/worker/job/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ failedJobId }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          result?: WorkerRunResult;
          error?: string;
        };
        if (!res.ok || !data.result) {
          throw new Error(data.error ?? "Retry failed");
        }
        saveClientWorkerLastRun(data.result);
        setLastRun(data.result);
        await refreshStatus();
        return data.result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Retry failed";
        setError(msg);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [refreshStatus],
  );

  useEffect(() => {
    if (options?.enabled === false) return;
    const settings = loadClientWorkerSettings();
    if (!settings.workerEnabled) return;

    const ms = Math.max(settings.intervalMinutes, 5) * 60_000;
    timerRef.current = setInterval(() => {
      void runCycle();
    }, ms);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [options?.enabled, runCycle]);

  const updateSettings = useCallback(
    (patch: Parameters<typeof saveClientWorkerSettings>[0]) => {
      return saveClientWorkerSettings(patch);
    },
    [],
  );

  return {
    running,
    lastRun,
    failedJobs,
    status,
    error,
    settings: loadClientWorkerSettings(),
    runCycle,
    retryJob,
    refreshStatus,
    updateSettings,
  };
}
