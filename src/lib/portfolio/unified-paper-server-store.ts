import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { UnifiedPortfolioSnapshot } from "./unified-types";

const SNAPSHOT_FILENAME = "unified-paper-portfolio.json";

export async function loadServerUnifiedPortfolio(): Promise<UnifiedPortfolioSnapshot | null> {
  return readCronJsonFile(SNAPSHOT_FILENAME, null);
}

export async function saveServerUnifiedPortfolio(
  snapshot: UnifiedPortfolioSnapshot,
): Promise<void> {
  await writeCronJsonFile(SNAPSHOT_FILENAME, snapshot);
}
