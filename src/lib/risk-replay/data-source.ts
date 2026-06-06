import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { loadServerUnifiedPortfolio } from "@/lib/portfolio/unified-paper-server-store";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  RiskReplayPricePoint,
  RiskReplaySide,
  RiskReplayTradeInput,
  RiskReplayTradeOption,
} from "./types";

function sideFromVerdict(input: string): RiskReplaySide {
  return input === "short" || input === "SELL" ? "SHORT" : "LONG";
}

function confidenceFromDecision(decision: DecisionLogEntry | undefined): number | null {
  if (!decision) return null;
  const committee = decision.agentOutputs.find((a) =>
    a.agentName.toLowerCase().includes("committee"),
  );
  if (!committee) return null;
  if (committee.confidence === "HIGH") return 0.8;
  if (committee.confidence === "MEDIUM") return 0.6;
  if (committee.confidence === "LOW") return 0.4;
  return null;
}

function syntheticPath(input: {
  openedAt: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
}): RiskReplayPricePoint[] {
  const start = Date.parse(input.openedAt);
  const end = Date.parse(input.closedAt);
  const mid1 = new Date(start + (end - start) * 0.33).toISOString();
  const mid2 = new Date(start + (end - start) * 0.66).toISOString();
  const higher = Math.max(input.entryPrice, input.exitPrice) * 1.01;
  const lower = Math.min(input.entryPrice, input.exitPrice) * 0.99;
  return [
    { timestamp: input.openedAt, price: input.entryPrice },
    { timestamp: mid1, price: higher },
    { timestamp: mid2, price: lower },
    { timestamp: input.closedAt, price: input.exitPrice },
  ];
}

function mapPaperTrade(input: {
  tradeId: string;
  decision?: DecisionLogEntry;
  row: {
    symbol: string;
    strategyName: string;
    decisionLogId: string;
    createdAt: string;
    closedAt: string | null;
    side: string;
    notionalUsd: number;
    entryPrice: number;
    exitPrice: number | null;
    realizedPnlUsd: number;
    sizePct: number;
  };
}): RiskReplayTradeInput | null {
  if (!input.row.closedAt || input.row.exitPrice == null) return null;
  return {
    tradeId: input.tradeId,
    environment: "PAPER",
    symbol: input.row.symbol,
    strategy: input.row.strategyName,
    side: sideFromVerdict(input.row.side),
    quantity:
      input.row.entryPrice > 0
        ? Math.max(input.row.notionalUsd / input.row.entryPrice, 0.000001)
        : 0.000001,
    notionalUsd: input.row.notionalUsd,
    openedAt: input.row.createdAt,
    closedAt: input.row.closedAt,
    entryPrice: input.row.entryPrice,
    exitPrice: input.row.exitPrice,
    actualPnlUsd: input.row.realizedPnlUsd,
    originalDecision: {
      decisionLogId: input.row.decisionLogId ?? null,
      finalVerdict: input.decision?.finalVerdict ?? null,
      confidence: confidenceFromDecision(input.decision),
      topReasons: input.decision?.topReasons ?? [],
    },
    originalRiskSettings: {
      profile: input.decision?.deskRiskProfile ?? "balanced",
      sizePct: input.row.sizePct,
      maxRiskPct: input.decision?.orderTicket?.maxRiskPct ?? null,
    },
    originalStopTakeProfit: {
      stopLoss: input.decision?.orderTicket?.stopLoss ?? null,
      takeProfit: input.decision?.orderTicket?.takeProfit ?? null,
    },
    marketPricePath: syntheticPath({
      openedAt: input.row.createdAt,
      closedAt: input.row.closedAt,
      entryPrice: input.row.entryPrice,
      exitPrice: input.row.exitPrice,
    }),
  };
}

function mapTestnetTrade(input: {
  tradeId: string;
  decision?: DecisionLogEntry;
  journal: {
    symbol: string;
    source: string;
    decisionLogId: string | null;
    createdAt: string;
    closedAt: string | null;
    side: "BUY" | "SELL";
    notionalUsd: number;
    realizedPnl: number | null;
    fees: number | null;
    quantity: string;
  };
  closedTrade: {
    entryPrice: number;
    exitPrice: number;
    closedAt: string;
  } | null;
}): RiskReplayTradeInput | null {
  const closedAt = input.journal.closedAt ?? input.closedTrade?.closedAt ?? null;
  if (!closedAt) return null;
  const entryPrice = input.closedTrade?.entryPrice ?? 0;
  const exitPrice = input.closedTrade?.exitPrice ?? 0;
  const pnl = (input.journal.realizedPnl ?? 0) - (input.journal.fees ?? 0);
  return {
    tradeId: input.tradeId,
    environment: "TESTNET",
    symbol: input.journal.symbol,
    strategy: input.journal.source,
    side: input.journal.side === "BUY" ? "LONG" : "SHORT",
    quantity: Math.max(Number(input.journal.quantity) || 0.000001, 0.000001),
    notionalUsd: Math.max(input.journal.notionalUsd, 1),
    openedAt: input.journal.createdAt,
    closedAt,
    entryPrice: entryPrice > 0 ? entryPrice : Math.max(input.journal.notionalUsd, 1),
    exitPrice: exitPrice > 0 ? exitPrice : Math.max(input.journal.notionalUsd + pnl, 1),
    actualPnlUsd: pnl,
    originalDecision: {
      decisionLogId: input.journal.decisionLogId,
      finalVerdict: input.decision?.finalVerdict ?? null,
      confidence: confidenceFromDecision(input.decision),
      topReasons: input.decision?.topReasons ?? [],
    },
    originalRiskSettings: {
      profile: input.decision?.deskRiskProfile ?? "balanced",
      sizePct: input.decision?.orderTicket?.positionSizePct ?? null,
      maxRiskPct: input.decision?.orderTicket?.maxRiskPct ?? null,
    },
    originalStopTakeProfit: {
      stopLoss: input.decision?.orderTicket?.stopLoss ?? null,
      takeProfit: input.decision?.orderTicket?.takeProfit ?? null,
    },
    marketPricePath: syntheticPath({
      openedAt: input.journal.createdAt,
      closedAt,
      entryPrice: entryPrice > 0 ? entryPrice : Math.max(input.journal.notionalUsd, 1),
      exitPrice: exitPrice > 0 ? exitPrice : Math.max(input.journal.notionalUsd + pnl, 1),
    }),
  };
}

function normalizeTradeInput(trade: RiskReplayTradeInput): RiskReplayTradeInput {
  return {
    ...trade,
    marketPricePath: trade.marketPricePath,
  };
}

export async function listRiskReplayTrades(): Promise<RiskReplayTradeOption[]> {
  const [portfolio, snapshot, binanceJournal] = await Promise.all([
    loadServerUnifiedPortfolio().catch(() => null),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadServerBinanceTestnetJournal().catch(() => []),
  ]);

  const paperTrades =
    portfolio?.closedTrades.map((row) => ({
      tradeId: row.id,
      environment: "PAPER" as const,
      symbol: row.symbol,
      strategy: row.strategyName,
      closedAt: row.closedAt ?? row.createdAt,
      actualPnlUsd: row.realizedPnlUsd,
      decisionLogId: row.decisionLogId ?? null,
    })) ?? [];

  const testnetTrades =
    snapshot?.closedTrades.map((row) => ({
      tradeId: row.id,
      environment: "TESTNET" as const,
      symbol: row.symbol,
      strategy: row.strategy,
      closedAt: row.closedAt,
      actualPnlUsd: row.netPnl,
      decisionLogId: row.decisionLogId,
    })) ?? [];

  const merged = [...paperTrades, ...testnetTrades];
  const byId = new Map(merged.map((t) => [t.tradeId, t]));
  for (const entry of binanceJournal) {
    if (!entry.closedAt || byId.has(entry.binanceTestnetTradeId)) continue;
    byId.set(entry.binanceTestnetTradeId, {
      tradeId: entry.binanceTestnetTradeId,
      environment: "TESTNET",
      symbol: entry.symbol,
      strategy: entry.source,
      closedAt: entry.closedAt,
      actualPnlUsd: entry.realizedPnl ?? 0,
      decisionLogId: entry.decisionLogId,
    });
  }

  return [...byId.values()].sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

export async function resolveRiskReplayTradeInput(
  tradeId: string,
): Promise<RiskReplayTradeInput | null> {
  const [decisions, portfolio, snapshot, binanceJournal] = await Promise.all([
    loadServerAnalysisJournal().catch(() => [] as DecisionLogEntry[]),
    loadServerUnifiedPortfolio().catch(() => null),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadServerBinanceTestnetJournal().catch(() => []),
  ]);

  const decisionById = new Map(decisions.map((d) => [d.id, d]));

  const paper = portfolio?.closedTrades.find((row) => row.id === tradeId);
  if (paper) {
    const mapped = mapPaperTrade({
      tradeId,
      row: {
        symbol: paper.symbol,
        strategyName: paper.strategyName,
        decisionLogId: paper.decisionLogId,
        createdAt: paper.createdAt,
        closedAt: paper.closedAt,
        side: paper.side,
        notionalUsd: paper.notionalUsd,
        entryPrice: paper.entryPrice,
        exitPrice: paper.exitPrice,
        realizedPnlUsd: paper.realizedPnlUsd,
        sizePct: paper.sizePct,
      },
      decision: decisionById.get(paper.decisionLogId),
    });
    return mapped ? normalizeTradeInput(mapped) : null;
  }

  const closed = snapshot?.closedTrades.find((row) => row.id === tradeId) ?? null;
  const journal =
    binanceJournal.find((entry) => entry.binanceTestnetTradeId === tradeId) ??
    (closed
      ? binanceJournal.find((entry) => entry.previewId === closed.previewId)
      : undefined) ??
    null;
  if (journal) {
    const mapped = mapTestnetTrade({
      tradeId,
      journal: {
        symbol: journal.symbol,
        source: journal.source,
        decisionLogId: journal.decisionLogId,
        createdAt: journal.createdAt,
        closedAt: journal.closedAt,
        side: journal.side,
        notionalUsd: journal.notionalUsd,
        realizedPnl: journal.realizedPnl,
        fees: journal.fees,
        quantity: journal.quantity,
      },
      decision: journal.decisionLogId
        ? decisionById.get(journal.decisionLogId)
        : undefined,
      closedTrade: closed
        ? {
            entryPrice: closed.entryPrice,
            exitPrice: closed.exitPrice,
            closedAt: closed.closedAt,
          }
        : null,
    });
    return mapped ? normalizeTradeInput(mapped) : null;
  }

  return null;
}
