import type { TestnetClosedTrade, TestnetLearningQueueItem } from "./types";

export const TESTNET_LEARNING_QUEUE_KEY = "btc-desk:testnet-learning-queue";
export const TESTNET_PERFORMANCE_KEY = "btc-desk:testnet-performance-segment";

export interface TestnetPerformanceSegment {
  environment: "TESTNET";
  totalTrades: number;
  winningTrades: number;
  netPnl: number;
  winRate: number;
  learnedTradeIds: string[];
  updatedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadLearningQueue(): TestnetLearningQueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(TESTNET_LEARNING_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TestnetLearningQueueItem[];
  } catch {
    return [];
  }
}

export function saveLearningQueue(items: TestnetLearningQueueItem[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(TESTNET_LEARNING_QUEUE_KEY, JSON.stringify(items));
}

export function syncLearningQueueFromClosedTrades(
  closedTrades: TestnetClosedTrade[],
): TestnetLearningQueueItem[] {
  const existing = loadLearningQueue();
  const byId = new Map(existing.map((e) => [e.closedTradeId, e]));
  for (const trade of closedTrades) {
    if (!byId.has(trade.id)) {
      byId.set(trade.id, {
        closedTradeId: trade.id,
        symbol: trade.symbol,
        decisionLogId: trade.decisionLogId,
        netPnl: trade.netPnl,
        result: trade.result,
        closedAt: trade.closedAt,
        status: trade.learned ? "LEARNED" : "PENDING",
        reflectionNotes: null,
      });
    }
  }
  const next = [...byId.values()].sort((a, b) =>
    b.closedAt.localeCompare(a.closedAt),
  );
  saveLearningQueue(next);
  return next;
}

export function markTradeAsLearned(closedTradeId: string): TestnetLearningQueueItem | null {
  let updated: TestnetLearningQueueItem | null = null;
  const next = loadLearningQueue().map((item) => {
    if (item.closedTradeId !== closedTradeId) return item;
    updated = { ...item, status: "LEARNED" };
    return updated;
  });
  if (updated) {
    saveLearningQueue(next);
    updateTestnetPerformanceSegment(updated);
  }
  return updated;
}

export function generateReflectionForTrade(
  closedTradeId: string,
  notes: string,
): TestnetLearningQueueItem | null {
  let updated: TestnetLearningQueueItem | null = null;
  const next = loadLearningQueue().map((item) => {
    if (item.closedTradeId !== closedTradeId) return item;
    updated = {
      ...item,
      status: "REFLECTION_READY",
      reflectionNotes: notes,
    };
    return updated;
  });
  if (updated) saveLearningQueue(next);
  return updated;
}

export function loadTestnetPerformanceSegment(): TestnetPerformanceSegment {
  if (!isBrowser()) {
    return {
      environment: "TESTNET",
      totalTrades: 0,
      winningTrades: 0,
      netPnl: 0,
      winRate: 0,
      learnedTradeIds: [],
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(TESTNET_PERFORMANCE_KEY);
    if (!raw) {
      return {
        environment: "TESTNET",
        totalTrades: 0,
        winningTrades: 0,
        netPnl: 0,
        winRate: 0,
        learnedTradeIds: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return JSON.parse(raw) as TestnetPerformanceSegment;
  } catch {
    return {
      environment: "TESTNET",
      totalTrades: 0,
      winningTrades: 0,
      netPnl: 0,
      winRate: 0,
      learnedTradeIds: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

function updateTestnetPerformanceSegment(item: TestnetLearningQueueItem): void {
  if (!isBrowser()) return;
  const seg = loadTestnetPerformanceSegment();
  if (seg.learnedTradeIds.includes(item.closedTradeId)) return;
  const next: TestnetPerformanceSegment = {
    environment: "TESTNET",
    totalTrades: seg.totalTrades + 1,
    winningTrades: seg.winningTrades + (item.result === "WIN" ? 1 : 0),
    netPnl: seg.netPnl + item.netPnl,
    winRate:
      ((seg.winningTrades + (item.result === "WIN" ? 1 : 0)) /
        (seg.totalTrades + 1)) *
      100,
    learnedTradeIds: [...seg.learnedTradeIds, item.closedTradeId],
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(TESTNET_PERFORMANCE_KEY, JSON.stringify(next));
}
