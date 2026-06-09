import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { TradeEvaluationResult } from "./types";

const EVALUATIONS_FILE = "self-learning-evaluations-server.json";
const MAX_STORED = 100;

export async function loadServerEvaluationResults(): Promise<TradeEvaluationResult[]> {
  const parsed = await readCronJsonFile<TradeEvaluationResult[]>(
    EVALUATIONS_FILE,
    [],
  );
  return Array.isArray(parsed) ? parsed : [];
}

export async function appendServerEvaluationResult(
  result: TradeEvaluationResult,
): Promise<TradeEvaluationResult[]> {
  const existing = await loadServerEvaluationResults();
  const withoutDup = existing.filter(
    (r) =>
      !(
        r.decisionLogId === result.decisionLogId &&
        r.source === result.source
      ),
  );
  const next = [result, ...withoutDup].slice(0, MAX_STORED);
  await writeCronJsonFile(EVALUATIONS_FILE, next);
  if (result.tradeQuality) {
    const { upsertTradeQualityScore } = await import(
      "@/lib/trade-quality-score/quality-store"
    );
    await upsertTradeQualityScore(result.tradeQuality).catch(() => null);
  }
  return next;
}
