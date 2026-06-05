"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDeskManagerSettings,
  saveDeskManagerSettings,
  shouldRunDailyLearning,
  shouldRunWeeklyReview,
} from "@/lib/autonomous-desk-manager/settings";
import {
  loadLastDeskManagerRun,
  persistDeskManagerResult,
} from "@/lib/autonomous-desk-manager/apply-desk-manager-client";
import type {
  DeskManagerCycleType,
  DeskManagerRunResult,
} from "@/lib/autonomous-desk-manager/types";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadEvaluationResults } from "@/lib/self-learning";
import { loadDiscoveredProposals } from "@/lib/rule-discovery/proposal-store";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { loadExperiments } from "@/lib/strategy-experiments/experiment-store";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadCouncilSessions } from "@/lib/council/council-session-store";
import type { DeskAutomationResult } from "@/lib/automation/automation-types";

function buildManagerPayload(cycleType: DeskManagerCycleType, automationResult?: DeskAutomationResult | null) {
  const settings = loadDeskManagerSettings();
  const lastRun = loadLastDeskManagerRun();
  return {
    cycleType,
    entries: loadDecisionLog(),
    orders: loadPaperOrders(),
    perpPositions: loadPerpPositions(),
    riskProfile: loadDeskSettings().riskProfile,
    governanceState: loadGovernanceState(),
    storedEvaluations: loadEvaluationResults(),
    storedRuleProposals: loadDiscoveredProposals(),
    storedAdaptationProposals: loadAdaptationProposals(),
    experiments: loadExperiments(),
    incidents: loadIncidents(),
    councilSessions: loadCouncilSessions(),
    lastManagerRunAt: lastRun?.timestamp ?? settings.lastOperationalRunAt,
    automationResult: automationResult ?? null,
  };
}

export function useAutonomousDeskManager(enabled = true) {
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<DeskManagerRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCycle = useCallback(
    async (
      cycleType: DeskManagerCycleType = "operational",
      automationResult?: DeskAutomationResult | null,
    ) => {
      const settings = loadDeskManagerSettings();
      if (!settings.enabled) return null;

      setRunning(true);
      setError(null);
      try {
        const res = await fetch("/api/desk-manager/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildManagerPayload(cycleType, automationResult),
          ),
        });
        const data = (await res.json()) as {
          ok: boolean;
          result?: DeskManagerRunResult;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.result) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        persistDeskManagerResult(data.result);
        setLastRun(data.result);
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Desk manager failed";
        setError(msg);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  useEffect(() => {
    setLastRun(loadLastDeskManagerRun());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const settings = loadDeskManagerSettings();
    if (!settings.enabled) return;

    const ms = Math.max(5, settings.operationalIntervalMinutes) * 60 * 1000;
    timerRef.current = setInterval(() => {
      void runCycle("operational");
      const s = loadDeskManagerSettings();
      if (shouldRunDailyLearning(s)) {
        void runCycle("daily_learning");
      }
      if (shouldRunWeeklyReview(s)) {
        void runCycle("weekly_strategy_review");
      }
    }, ms);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, runCycle]);

  const toggleEnabled = useCallback((on: boolean) => {
    saveDeskManagerSettings({ enabled: on });
  }, []);

  return {
    running,
    lastRun,
    error,
    runCycle,
    toggleEnabled,
    settings: loadDeskManagerSettings(),
  };
}
