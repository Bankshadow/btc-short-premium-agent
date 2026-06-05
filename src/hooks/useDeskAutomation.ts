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
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadDeskManagerSettings } from "@/lib/autonomous-desk-manager/settings";
import { persistDeskManagerResult } from "@/lib/autonomous-desk-manager/apply-desk-manager-client";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { loadEvaluationResults } from "@/lib/self-learning";
import { loadDiscoveredProposals } from "@/lib/rule-discovery/proposal-store";
import { loadAdaptationProposals } from "@/lib/strategy-adaptation/proposal-store";
import { loadExperiments } from "@/lib/strategy-experiments/experiment-store";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { loadCouncilSessions } from "@/lib/council/council-session-store";
import { loadLastDeskManagerRun } from "@/lib/autonomous-desk-manager/apply-desk-manager-client";

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
          perpPositions: loadPerpPositions(),
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

      const mgrSettings = loadDeskManagerSettings();
      if (mgrSettings.enabled && mgrSettings.chainWithDeskAutomation) {
        try {
          const mgrRes = await fetch("/api/desk-manager/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cycleType: "operational",
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
              lastManagerRunAt: loadLastDeskManagerRun()?.timestamp,
              automationResult: data,
            }),
          });
          const mgrData = (await mgrRes.json()) as {
            ok: boolean;
            result?: import("@/lib/autonomous-desk-manager/types").DeskManagerRunResult;
          };
          if (mgrRes.ok && mgrData.ok && mgrData.result) {
            persistDeskManagerResult(mgrData.result);
          }
        } catch {
          // Desk manager chain is best-effort
        }
      }

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
