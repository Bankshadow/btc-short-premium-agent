import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  blockBinanceProductionOrder,
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "./binance-config";
import { resolvePrimaryStrategyHealth } from "@/lib/mission-flow/resolve-primary-strategy-health";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { buildBinancePreviewInputFromAiSignal } from "./build-ai-preview";
import { buildOrderPreview } from "./binance-order-preview";
import { executeBinanceTestnetOrder } from "./binance-execution";
import { getBinanceStatus } from "./binance-futures-testnet";

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
 * When the desk committee verdict is TRADE and autonomous testnet mode is enabled,
 * this builds an AI-sourced preview and submits a testnet market order using a
 * machine double-confirmation. This path is testnet-only: production order placement
 * is hard-blocked via `blockBinanceProductionOrder` and `BINANCE_LIVE_ENABLED`.
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
  if (verdict !== "TRADE") {
    return {
      ...base,
      outcome: "NO_TRADE_SIGNAL",
      summary: `Committee verdict ${verdict} — no testnet order.`,
    };
  }

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

    const previewInput = buildBinancePreviewInputFromAiSignal({
      data: input.analysis,
      decisionLogId: input.decisionLogId ?? null,
    });
    const preview = await buildOrderPreview(previewInput);
    base.previewId = preview.previewId;
    base.symbol = preview.symbol;
    base.side = preview.side;

    if (preview.blocked) {
      return {
        ...base,
        outcome: "PREVIEW_BLOCKED",
        blockReasons: preview.blockReasons,
        summary: `Preview blocked: ${preview.blockReasons[0] ?? "risk gate"}`,
      };
    }

    const result = await executeBinanceTestnetOrder({
      execute: {
        previewId: preview.previewId,
        // Machine double-confirm — testnet-only autonomous mode.
        doubleConfirm: true,
        operatorNote: "Autonomous testnet executor (AI committee TRADE)",
      },
      commandCenterStatus: input.commandCenterStatus ?? null,
      entries: input.entries,
      orders: input.orders,
      operatorNote: "Autonomous testnet executor (AI committee TRADE)",
    });

    if (result.blocked || !result.ok) {
      return {
        ...base,
        outcome: result.blocked ? "EXECUTE_BLOCKED" : "ERROR",
        blockReasons: result.journalEntry?.blockReasons ?? [],
        exchangeOrderId: result.exchangeOrderId,
        summary:
          result.error ??
          result.journalEntry?.blockReasons?.[0] ??
          "Testnet execute blocked.",
      };
    }

    void emitMissionAlert({
      kind: "trade_opened",
      title: "Autopilot opened testnet trade",
      body: `${preview.side} ${preview.symbol} qty ${preview.estimatedQty} · order ${result.exchangeOrderId}`,
    });

    return {
      ...base,
      outcome: "EXECUTED",
      exchangeOrderId: result.exchangeOrderId,
      summary: `Executed ${preview.side} ${preview.symbol} qty ${preview.estimatedQty} (order ${result.exchangeOrderId}).`,
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
