"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAutopilotSettings,
  loadLastAutopilotRun,
  saveAutopilotSettings,
  saveLastAutopilotRun,
} from "@/lib/autopilot/settings-store";
import { mergeOperatorActionQueue } from "@/lib/operator-action-queue/queue-store";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { writeDeskCycle } from "@/lib/data-backbone/write-desk-cycle";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  loadPaperAutopilotSettings,
  resolvePaperAutopilotModeFromAutopilot,
  runPaperAutopilot,
} from "@/lib/paper-autopilot";
import {
  emitFromAutopilotResult,
  emitFromPaperAutopilotResult,
} from "@/lib/smart-briefing/event-helpers";

export function useAutopilot(options?: {
  enabled?: boolean;
  latestAnalysis?: AnalyzeApiResponse | null;
  onBeforeAnalyze?: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<AutopilotRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLastRun(loadLastAutopilotRun());
  }, []);

  const runCycle = useCallback(
    async (opts?: { triggerAnalyze?: boolean }) => {
      const settings = loadAutopilotSettings();
      if (!settings.autopilotEnabled) return null;

      setRunning(true);
      setError(null);
      try {
        if (opts?.triggerAnalyze && options?.onBeforeAnalyze) {
          await options.onBeforeAnalyze();
        }

        const res = await fetch("/api/autopilot/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: loadDecisionLog(),
            orders: loadPaperOrders(),
            perpPositions: loadPerpPositions(),
            riskProfile: loadDeskSettings().riskProfile,
            latestAnalysis: options?.latestAnalysis ?? null,
            settings,
            skipAnalyze: !options?.latestAnalysis,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          result?: AutopilotRunResult;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.result) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        saveLastAutopilotRun(data.result);
        mergeOperatorActionQueue(data.result.actionsCreated);
        setLastRun(data.result);

        const analysis = data.result.analyze ?? options?.latestAnalysis ?? null;
        const btc = analysis?.step1_marketSnapshot.spotPrice ?? 0;
        const paStored = loadPaperAutopilotSettings();
        const paMode =
          paStored.mode !== "OFF"
            ? paStored.mode
            : resolvePaperAutopilotModeFromAutopilot(settings);
        if (paMode !== "OFF" && btc > 0) {
          const paResult = runPaperAutopilot({
            data: analysis,
            btcPrice: btc,
            settings: {
              mode: paMode,
              autoResolveEnabled: settings.autoResolveEnabled,
              maxPaperTradesPerDay: settings.maxPaperTradesPerDay,
              maxShadowTradesPerDay: settings.maxShadowTradesPerDay,
            },
          });
          void emitFromPaperAutopilotResult(paResult);
        }

        void emitFromAutopilotResult(data.result);
        await writeDeskCycle({ autopilotResult: data.result });
        return data.result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Autopilot failed";
        setError(msg);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [options?.latestAnalysis, options?.onBeforeAnalyze],
  );

  useEffect(() => {
    if (options?.enabled === false) return;
    const settings = loadAutopilotSettings();
    if (!settings.autopilotEnabled) return;

    const ms = Math.max(settings.runIntervalMinutes, 5) * 60_000;
    timerRef.current = setInterval(() => {
      void runCycle();
    }, ms);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [options?.enabled, runCycle]);

  const updateSettings = useCallback(
    (patch: Parameters<typeof saveAutopilotSettings>[0]) => {
      return saveAutopilotSettings(patch);
    },
    [],
  );

  return {
    running,
    lastRun,
    error,
    settings: loadAutopilotSettings(),
    runCycle,
    updateSettings,
  };
}
