import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";

const STORE_FILE = "risk-replay-review-history.json";
const MAX_HISTORY = 200;

export interface RiskReplayReviewRecord {
  reviewedAt: string;
  tradeId: string;
  source: "RISK_REPLAY_RUN" | "OPERATOR_NOTE";
}

export async function loadRiskReplayReviewHistory(): Promise<RiskReplayReviewRecord[]> {
  const parsed = await readCronJsonFile<RiskReplayReviewRecord[]>(STORE_FILE, []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function appendRiskReplayReview(record: RiskReplayReviewRecord): Promise<void> {
  const current = await loadRiskReplayReviewHistory();
  const next = [record, ...current].slice(0, MAX_HISTORY);
  await writeCronJsonFile(STORE_FILE, next);
}
