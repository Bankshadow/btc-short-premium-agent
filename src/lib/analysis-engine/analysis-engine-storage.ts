import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { AnalysisAuditEvent, AnalysisResult } from "./analysis-result";
import type { CentralAnalysisState } from "./analysis-state";
import {
  CENTRAL_ANALYSIS_ENGINE_LABEL,
  CENTRAL_ANALYSIS_ENGINE_MVP,
} from "./analysis-state";

const STATE_FILE = "central-analysis-state.json";
const RESULTS_FILE = "central-analysis-results.json";
const MAX_RESULTS = 50;

export function emptyCentralAnalysisState(): CentralAnalysisState {
  return {
    mvp: CENTRAL_ANALYSIS_ENGINE_MVP,
    label: CENTRAL_ANALYSIS_ENGINE_LABEL,
    latestRunId: null,
    latestDecisionLogId: null,
    latestResultAt: null,
    context: null,
    liveTradingLocked: true,
    lastUpdatedAt: new Date(0).toISOString(),
  };
}

export async function loadCentralAnalysisState(): Promise<CentralAnalysisState> {
  const raw = await readCronJsonFile<CentralAnalysisState>(STATE_FILE, emptyCentralAnalysisState());
  return { ...emptyCentralAnalysisState(), ...raw };
}

export async function saveCentralAnalysisState(
  state: CentralAnalysisState,
): Promise<void> {
  await writeCronJsonFile(STATE_FILE, {
    ...state,
    lastUpdatedAt: new Date().toISOString(),
  });
}

export async function loadCentralAnalysisResults(): Promise<AnalysisResult[]> {
  const raw = await readCronJsonFile<AnalysisResult[]>(RESULTS_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

export async function appendCentralAnalysisResult(
  result: AnalysisResult,
): Promise<void> {
  const existing = await loadCentralAnalysisResults();
  await writeCronJsonFile(RESULTS_FILE, [result, ...existing].slice(0, MAX_RESULTS));
}

export async function loadLatestCentralAnalysisResult(): Promise<AnalysisResult | null> {
  const results = await loadCentralAnalysisResults();
  return results[0] ?? null;
}

export async function loadCentralAnalysisEvents(): Promise<AnalysisAuditEvent[]> {
  const { queryEngineEvents } = await import("@/lib/engine-event-bus/engine-event-store");
  const { events } = await queryEngineEvents({ limit: 200 });
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    detail: e.detail,
    timestamp: e.timestamp,
    linkedDecisionLogId: e.decisionLogId,
  }));
}

export async function appendCentralAnalysisEvents(
  events: AnalysisAuditEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const { mergeLegacyCentralAnalysisEvents } = await import(
    "@/lib/engine-event-bus/engine-event-store"
  );
  await mergeLegacyCentralAnalysisEvents(events);
}

export async function persistCentralAnalysisRun(input: {
  state: CentralAnalysisState;
  result: AnalysisResult;
  auditEvents: AnalysisAuditEvent[];
}): Promise<void> {
  await Promise.all([
    saveCentralAnalysisState(input.state),
    appendCentralAnalysisResult(input.result),
    appendCentralAnalysisEvents(input.auditEvents),
  ]);
}
