import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  blockBinanceProductionOrder,
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "./binance-config";
import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import { resolvePrimaryStrategyHealth } from "@/lib/mission-flow/resolve-primary-strategy-health";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { loadServerBinanceTestnetJournal } from "./binance-testnet-journal-server";
import { buildBinancePreviewInputFromAiSignal } from "./build-ai-preview";
import { buildOrderPreview } from "./binance-order-preview";
import { executeBinanceTestnetOrder } from "./binance-execution";
import { getBinanceStatus, getPositions } from "./binance-futures-testnet";
import { pickAutopilotTradeCandidates } from "./pick-autopilot-symbols";
import { recordAutopilotCycleOutcome } from "./symbol-rotation-store";

export type BinanceAutoExecuteOutcome =
  | "DISABLED"
  | "PRODUCTION_BLOCKED"
  | "NOT_CONNECTED"
  | "NO_TRADE_SIGNAL"
  | "PREVIEW_BLOCKED"
  | "STRATEGY_BLOCKED"
  | "EXECUTE_BLOCKED"
  | "EXECUTED"
  | "ERROR";

export interface BinanceAutoExecuteResult {
  outcome: BinanceAutoExecuteOutcome;
  summary: string;
  previewId: string | null;
  exchangeOrderId: string | null;
  blockReasons: string[];
  symbol: string | null;
  side: string | null;
  executedCount: number;
  executedSymbols: string[];
  /** Machine confirmation is testnet-only — live trading remains hard-blocked. */
  liveBlocked: true;
}

function resolveCommitteeVerdict(data: AnalyzeApiResponse | null): string {
  const verdict =
    data?.tradingDesk?.weightedCommittee?.weightedVerdict ??
    data?.step5_verdict?.recommendation ??
    "WAIT";
  return String(verdict).toUpperCase();
}

/**
 * Autonomous Binance USD-M Futures **testnet** executor.
 *
 * Scans multiple allowlisted symbols, ranks actionable perp signals, and fills
 * open position slots up to `maxOpenPositions`. Testnet-only — production blocked.
 */
export async function runBinanceTestnetAutoExecute(input: {
  analysis: AnalyzeApiResponse | null;
  decisionLogId?: string | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  commandCenterStatus?: string | null;
}): Promise<BinanceAutoExecuteResult> {
  const base: Omit<BinanceAutoExecuteResult, "outcome" | "summary"> = {
    previewId: null,
    exchangeOrderId: null,
    blockReasons: [],
    symbol: null,
    side: null,
    executedCount: 0,
    executedSymbols: [],
    liveBlocked: true,
  };

  if (!isBinanceTestnetAutoExecuteEnabled()) {
    return {
      ...base,
      outcome: "DISABLED",
      summary: "Autonomous testnet execution disabled (BINANCE_TESTNET_AUTOEXECUTE_ENABLED).",
    };
  }

  const productionBlock = blockBinanceProductionOrder();
  if (productionBlock) {
    return {
      ...base,
      outcome: "PRODUCTION_BLOCKED",
      blockReasons: [productionBlock],
      summary: productionBlock,
    };
  }

  const config = loadBinanceConfig();
  if (!config.testnetEnabled) {
    return {
      ...base,
      outcome: "DISABLED",
      summary: "BINANCE_TESTNET_ENABLED is not true.",
    };
  }

  const verdict = resolveCommitteeVerdict(input.analysis);

  try {
    const status = await getBinanceStatus();
    if (!status.connected) {
      return {
        ...base,
        outcome: "NOT_CONNECTED",
        summary: status.error ?? "Binance testnet not connected.",
      };
    }

    if (input.entries && input.orders) {
      const strategySummary = buildStrategyHealthSummary({
        entries: input.entries,
        orders: input.orders,
      });
      const strategy = resolvePrimaryStrategyHealth(strategySummary);
      if (strategy && !strategy.tradeAllowed) {
        return {
          ...base,
          outcome: "STRATEGY_BLOCKED",
          blockReasons: [strategy.blockReason ?? "Strategy health blocked new trades."],
          summary: strategy.blockReason ?? "Strategy health blocked new trades.",
        };
      }
    }

    const positions = await getPositions();
    const openSymbols = positions
      .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
      .map((p) => p.symbol);
    const slots = Math.max(0, config.maxOpenPositions - openSymbols.length);

    if (slots === 0) {
      return {
        ...base,
        outcome: "PREVIEW_BLOCKED",
        blockReasons: [`Max ${config.maxOpenPositions} open positions`],
        summary: `All ${config.maxOpenPositions} position slots filled.`,
      };
    }

    const candidates = await pickAutopilotTradeCandidates({
      analysis: input.analysis,
      openSymbols,
      maxCandidates: slots,
    });

    if (candidates.length === 0) {
      await recordAutopilotCycleOutcome({
        tradedSymbols: [],
        candidateSymbols: [],
      });
      return {
        ...base,
        outcome: "NO_TRADE_SIGNAL",
        summary: `No trade candidates · committee ${verdict}.`,
      };
    }

    const journal = await loadServerBinanceTestnetJournal().catch(() => []);
    const completedTrades = journal.filter((j) => j.status === "CLOSED").length;
    const executedSymbols: string[] = [];
    const blockReasons: string[] = [];
    let lastPreviewId: string | null = null;
    let lastOrderId: string | null = null;
    let lastSymbol: string | null = null;
    let lastSide: string | null = null;

    for (const candidate of candidates) {
      const previewInput = buildBinancePreviewInputFromAiSignal({
        data: input.analysis,
        decisionLogId: input.decisionLogId ?? null,
        completedTrades,
        minTradesForTrust: GOAL_MIN_TRADES_FOR_TRUST,
        symbol: candidate.symbol,
        side: candidate.side,
        reason: candidate.reason,
      });
      const preview = await buildOrderPreview(previewInput);
      lastPreviewId = preview.previewId;
      lastSymbol = preview.symbol;
      lastSide = preview.side;

      if (preview.blocked) {
        blockReasons.push(
          `${candidate.symbol}: ${preview.blockReasons[0] ?? "risk gate"}`,
        );
        continue;
      }

      const result = await executeBinanceTestnetOrder({
        execute: {
          previewId: preview.previewId,
          doubleConfirm: true,
          operatorNote: `Autopilot ${candidate.source} · ${candidate.reason}`,
        },
        commandCenterStatus: input.commandCenterStatus ?? null,
        entries: input.entries,
        orders: input.orders,
        operatorNote: `Autopilot ${candidate.source} · ${candidate.reason}`,
      });

      if (result.blocked || !result.ok) {
        blockReasons.push(
          result.error ??
            result.journalEntry?.blockReasons?.[0] ??
            `${candidate.symbol}: execute blocked`,
        );
        continue;
      }

      executedSymbols.push(candidate.symbol);
      lastOrderId = result.exchangeOrderId;

      void emitMissionAlert({
        kind: "trade_opened",
        title: "Autopilot opened testnet trade",
        body: `${preview.side} ${preview.symbol} qty ${preview.estimatedQty} · order ${result.exchangeOrderId}`,
      });
    }

    await recordAutopilotCycleOutcome({
      tradedSymbols: executedSymbols,
      candidateSymbols: candidates.map((c) => c.symbol),
    });

    if (executedSymbols.length > 0) {
      return {
        ...base,
        outcome: "EXECUTED",
        previewId: lastPreviewId,
        exchangeOrderId: lastOrderId,
        symbol: lastSymbol,
        side: lastSide,
        executedCount: executedSymbols.length,
        executedSymbols,
        summary: `Executed ${executedSymbols.length} trade(s): ${executedSymbols.join(", ")}.`,
      };
    }

    return {
      ...base,
      previewId: lastPreviewId,
      symbol: lastSymbol,
      side: lastSide,
      blockReasons,
      outcome: "EXECUTE_BLOCKED",
      summary: blockReasons[0] ?? "All candidate orders blocked.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-execute failed";
    return {
      ...base,
      outcome: "ERROR",
      summary: message,
    };
  }
}
