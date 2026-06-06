import fs from "fs/promises";
import path from "path";
import { getCronDataDir } from "@/lib/cron/cron-config";
import { loadBinanceConfig } from "./binance-config";
import { getExchangeInfo, getMarkPrice } from "./binance-futures-testnet";
import { validateOrderAgainstRiskGate } from "./binance-risk-gate";
import { loadServerBinanceTestnetJournal } from "./binance-testnet-journal-server";
import type {
  BinanceOrderPreview,
  BinanceOrderPreviewInput,
} from "./binance-types";

const PREVIEW_TTL_MS = 5 * 60 * 1000;
const PREVIEW_CACHE_FILE = "binance-preview-cache.json";

function previewFilePath(): string {
  return path.join(getCronDataDir(), PREVIEW_CACHE_FILE);
}

function newPreviewId(): string {
  return `bn-prev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Binance USD-M testnet minimum notional (observed on demo-fapi). */
const BINANCE_MIN_NOTIONAL_USD = 50;

function roundQtyCeil(qty: number, precision: number): string {
  const factor = 10 ** precision;
  const rounded = Math.ceil(qty * factor) / factor;
  return rounded.toFixed(precision);
}

export function resolveEstimatedQty(
  notionalUsd: number,
  markPrice: number,
  qtyPrecision: number,
  maxNotionalUsd: number,
): string {
  const step = 1 / 10 ** qtyPrecision;
  let qty = notionalUsd / markPrice;
  let estimated = roundQtyCeil(qty, qtyPrecision);
  let effective = Number(estimated) * markPrice;

  while (
    effective < BINANCE_MIN_NOTIONAL_USD &&
    effective <= maxNotionalUsd &&
    Number(estimated) > 0
  ) {
    estimated = (Number(estimated) + step).toFixed(qtyPrecision);
    effective = Number(estimated) * markPrice;
  }

  return estimated;
}

async function loadPreviewCache(): Promise<Record<string, BinanceOrderPreview>> {
  try {
    const raw = await fs.readFile(previewFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, BinanceOrderPreview>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function savePreviewCache(
  cache: Record<string, BinanceOrderPreview>,
): Promise<void> {
  const filePath = previewFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const pruned = Object.fromEntries(
    Object.entries(cache).filter(
      ([, p]) => Date.now() <= Date.parse(p.expiresAt),
    ),
  );
  await fs.writeFile(filePath, JSON.stringify(pruned, null, 2), "utf8");
}

export async function getStoredPreview(
  previewId: string,
): Promise<BinanceOrderPreview | null> {
  const cache = await loadPreviewCache();
  const preview = cache[previewId];
  if (!preview) return null;
  if (Date.now() > Date.parse(preview.expiresAt)) return null;
  return preview;
}

const EXECUTED_PREVIEW_STATUSES = new Set([
  "SUBMITTED",
  "FILLED",
  "CLOSING",
  "CLOSED",
]);

/** Active preview awaiting human double-confirm (not yet executed). */
export async function findPendingTestnetPreview(
  latestDecisionLogId?: string | null,
): Promise<BinanceOrderPreview | null> {
  const cache = await loadPreviewCache();
  const journal = await loadServerBinanceTestnetJournal().catch(() => []);
  const executedPreviewIds = new Set(
    journal
      .filter((j) => EXECUTED_PREVIEW_STATUSES.has(j.status))
      .map((j) => j.previewId),
  );

  const candidates = Object.values(cache)
    .filter((p) => Date.now() <= Date.parse(p.expiresAt))
    .filter((p) => !executedPreviewIds.has(p.previewId));

  if (candidates.length === 0) return null;

  if (latestDecisionLogId) {
    const linked = candidates.find(
      (p) => p.decisionLogId === latestDecisionLogId,
    );
    if (linked) return linked;
  }

  return (
    candidates.sort(
      (a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt),
    )[0] ?? null
  );
}

export async function buildOrderPreview(
  input: BinanceOrderPreviewInput,
): Promise<BinanceOrderPreview> {
  const config = loadBinanceConfig();
  const symbol = input.symbol.toUpperCase();
  const markPrice = await getMarkPrice(symbol);

  let estimatedQty = "0";
  let qtyPrecision = 3;

  try {
    const { symbols } = await getExchangeInfo();
    const info = symbols.find((s) => s.symbol === symbol);
    if (info) {
      qtyPrecision = info.quantityPrecision;
    }
  } catch {
    // Use default precision
  }

  if (markPrice && markPrice > 0) {
    estimatedQty = resolveEstimatedQty(
      input.notionalUsd,
      markPrice,
      qtyPrecision,
      config.maxNotionalUsd,
    );
  }

  const previewId = newPreviewId();
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
  const generatedAt = new Date().toISOString();

  const draft: BinanceOrderPreview = {
    previewId,
    symbol,
    side: input.side,
    estimatedQty,
    notionalUsd: input.notionalUsd,
    markPrice,
    riskChecks: [],
    blocked: false,
    blockReasons: [],
    requiresDoubleConfirm: config.requireDoubleConfirm,
    expiresAt,
    source: input.source,
    reason: input.reason,
    decisionLogId: input.decisionLogId ?? null,
    generatedAt,
  };

  const gate = validateOrderAgainstRiskGate({ preview: draft });
  const preview: BinanceOrderPreview = {
    ...draft,
    riskChecks: gate.riskChecks,
    blocked: gate.blocked,
    blockReasons: gate.blockReasons,
  };

  const cache = await loadPreviewCache();
  cache[previewId] = preview;
  await savePreviewCache(cache);

  return preview;
}
