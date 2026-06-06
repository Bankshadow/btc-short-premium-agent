import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import type { TradeEvaluationResult } from "./types";

const EVALUATIONS_FILE = "self-learning-evaluations-server.json";
const MAX_STORED = 100;

function filePath(): string {
  return path.join(getCronDataDir(), EVALUATIONS_FILE);
}

export async function loadServerEvaluationResults(): Promise<TradeEvaluationResult[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as TradeEvaluationResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const fp = filePath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(next, null, 2), "utf8");
  return next;
}
