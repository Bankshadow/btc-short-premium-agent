"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAutomationActions,
  loadAutomationSettings,
  loadLastAutomationRun,
  saveAutomationSettings,
  saveLastAutomationRun,
} from "@/lib/automation/apply-automation-client";
import type { DeskAutomationResult } from "@/lib/automation/automation-types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDeskSettings } from "@/lib/desk/desk-settings";

export function useDeskAutomation(enabled = true) {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<DeskAutomationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCycle = useCallback(async () => {
    const settings = loadAutomationSettings();
    if (!settings.enabled) return null;

    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: loadDecisionLog(),
          orders: loadPaperOrders(),
          riskProfile: loadDeskSettings().riskProfile,
        }),
      });
      const data = (await res.json()) as DeskAutomationResult & {
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      saveLastAutomationRun(data);
      setLastRun(data);

      const applyResult = applyAutomationActions(data.actions, settings);
      setApplied(applyResult.applied);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Automation failed";
      setError(msg);
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    setLastRun(loadLastAutomationRun());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const settings = loadAutomationSettings();
    if (!settings.enabled) return;

    const ms = Math.max(5, settings.intervalMinutes) * 60 * 1000;
    timerRef.current = setInterval(() => {
      void runCycle();
    }, ms);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, runCycle]);

  const toggleEnabled = useCallback((on: boolean) => {
    saveAutomationSettings({ enabled: on });
  }, []);

  return {
    running,
    lastRun,
    error,
    applied,
    runCycle,
    toggleEnabled,
    settings: loadAutomationSettings(),
  };
}
