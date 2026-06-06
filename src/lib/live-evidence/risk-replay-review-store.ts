import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";

const STORE_FILE = "risk-replay-review-history.json";
const MAX_HISTORY = 200;

function filePath(): string {
  return path.join(getCronDataDir(), STORE_FILE);
}

export interface RiskReplayReviewRecord {
  reviewedAt: string;
  tradeId: string;
  source: "RISK_REPLAY_RUN" | "OPERATOR_NOTE";
}

export async function loadRiskReplayReviewHistory(): Promise<RiskReplayReviewRecord[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as RiskReplayReviewRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendRiskReplayReview(record: RiskReplayReviewRecord): Promise<void> {
  const current = await loadRiskReplayReviewHistory();
  const next = [record, ...current].slice(0, MAX_HISTORY);
  const fp = filePath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(next, null, 2), "utf8");
}
