import { getCronDataDir } from "@/lib/cron/cron-config";
import type { UnifiedPortfolioSnapshot } from "./unified-types";
import fs from "fs/promises";
import path from "path";

const SNAPSHOT_FILENAME = "unified-paper-portfolio.json";

function snapshotPath(): string {
  return path.join(getCronDataDir(), SNAPSHOT_FILENAME);
}

export async function loadServerUnifiedPortfolio(): Promise<UnifiedPortfolioSnapshot | null> {
  try {
    const raw = await fs.readFile(snapshotPath(), "utf8");
    return JSON.parse(raw) as UnifiedPortfolioSnapshot;
  } catch {
    return null;
  }
}

export async function saveServerUnifiedPortfolio(
  snapshot: UnifiedPortfolioSnapshot,
): Promise<void> {
  const filePath = snapshotPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}
