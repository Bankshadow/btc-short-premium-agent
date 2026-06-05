import type { ExperimentAuditEntry, StrategyExperiment } from "./types";

export const EXPERIMENTS_STORAGE_KEY = "btc-desk:strategy-experiments";
export const EXPERIMENT_AUDIT_KEY = "btc-desk:strategy-experiment-audit";

export function loadExperiments(): StrategyExperiment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXPERIMENTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StrategyExperiment[];
  } catch {
    return [];
  }
}

export function saveExperiments(experiments: StrategyExperiment[]): StrategyExperiment[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(EXPERIMENTS_STORAGE_KEY, JSON.stringify(experiments.slice(0, 40)));
  }
  return experiments;
}

export function appendExperiment(experiment: StrategyExperiment): StrategyExperiment[] {
  return saveExperiments([experiment, ...loadExperiments()]);
}

export function updateExperiment(
  experimentId: string,
  patch: Partial<StrategyExperiment>,
): StrategyExperiment | null {
  const list = loadExperiments();
  const idx = list.findIndex((e) => e.experimentId === experimentId);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  saveExperiments(list);
  return list[idx];
}

export function getExperimentById(id: string): StrategyExperiment | null {
  return loadExperiments().find((e) => e.experimentId === id) ?? null;
}

export function loadExperimentAudit(): ExperimentAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXPERIMENT_AUDIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ExperimentAuditEntry[];
  } catch {
    return [];
  }
}

export function appendExperimentAudit(entry: ExperimentAuditEntry): ExperimentAuditEntry[] {
  const next = [entry, ...loadExperimentAudit()].slice(0, 100);
  if (typeof window !== "undefined") {
    localStorage.setItem(EXPERIMENT_AUDIT_KEY, JSON.stringify(next));
  }
  return next;
}
