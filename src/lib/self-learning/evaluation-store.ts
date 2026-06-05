import type { TradeEvaluationResult } from "./types";

export const EVALUATION_STORAGE_KEY =
  "btc-desk:self-learning-evaluations";

const MAX_STORED = 80;

export function loadEvaluationResults(): TradeEvaluationResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVALUATION_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TradeEvaluationResult[];
  } catch {
    return [];
  }
}

function persist(results: TradeEvaluationResult[]): TradeEvaluationResult[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      EVALUATION_STORAGE_KEY,
      JSON.stringify(results.slice(0, MAX_STORED)),
    );
  }
  return results;
}

export function appendEvaluationResult(
  result: TradeEvaluationResult,
): TradeEvaluationResult[] {
  const existing = loadEvaluationResults();
  const withoutDup = existing.filter(
    (r) =>
      !(
        r.decisionLogId === result.decisionLogId &&
        r.source === result.source &&
        Math.abs(
          new Date(r.generatedAt).getTime() -
            new Date(result.generatedAt).getTime(),
        ) < 5000
      ),
  );
  return persist([result, ...withoutDup]);
}

export function mergeEvaluationResults(
  incoming: TradeEvaluationResult[],
): TradeEvaluationResult[] {
  const map = new Map<string, TradeEvaluationResult>();
  for (const r of [...incoming, ...loadEvaluationResults()]) {
    map.set(r.evaluationId, r);
  }
  return persist(
    [...map.values()].sort((a, b) =>
      b.generatedAt.localeCompare(a.generatedAt),
    ),
  );
}
