import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  blockBinanceProductionOrder,
  isBinanceForceMaxAutopilotEnabled,
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
  | "LOOP_GUARD_BLOCKED"
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
  runId?: string | null;
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
  const forceMax = isBinanceForceMaxAutopilotEnabled();
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

    if (input.entries && input.orders && !forceMax) {
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

    const journal = await loadServerBinanceTestnetJournal().catch(() => []);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tradesToday = journal.filter(
      (j) =>
        new Date(j.createdAt).getTime() >= todayStart.getTime() &&
        j.status !== "BLOCKED" &&
        j.status !== "PREVIEWED",
    ).length;
    const dailyRemaining = Math.max(0, config.maxTradesPerDay - tradesToday);
    const positionSlots = Math.max(0, config.maxOpenPositions - openSymbols.length);
    const slots = Math.min(positionSlots, dailyRemaining);

    if (slots === 0) {
      const reason =
        dailyRemaining === 0
          ? `Daily limit ${config.maxTradesPerDay} reached (${tradesToday} today).`
          : `All ${config.maxOpenPositions} position slots filled.`;
      return {
        ...base,
        outcome: "PREVIEW_BLOCKED",
        blockReasons: [reason],
        summary: reason,
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
        summary: forceMax
          ? `Force-max enabled but no empty symbol slots · committee ${verdict}.`
          : `No trade candidates · committee ${verdict}.`,
      };
    }

    const completedTrades = journal.filter((j) => j.status === "CLOSED").length;
    const submittedPreviewIds = journal
      .filter((j) =>
        ["SUBMITTED", "FILLED", "CLOSING", "CLOSED"].includes(j.status),
      )
      .map((j) => j.previewId);
    const executedSymbols: string[] = [];
    const blockReasons: string[] = [];
    const recentPreviewFingerprints: string[] = [];
    let lastPreviewId: string | null = null;
    let lastOrderId: string | null = null;
    let lastSymbol: string | null = null;
    let lastSide: string | null = null;

    const {
      checkOrderHardSafety,
      buildPreviewFingerprint,
      buildTradeCandidateKey,
    } = await import("@/lib/autopilot-loop-guard");
    const { recordLoopGuardAction } = await import(
      "@/lib/autopilot-loop-guard/record-action"
    );

    for (const candidate of candidates) {
      const candidateKey = buildTradeCandidateKey({
        symbol: candidate.symbol,
        side: candidate.side,
        reason: candidate.reason,
        source: candidate.source,
      });
      const previewInput = buildBinancePreviewInputFromAiSignal({
        data: input.analysis,
        decisionLogId: input.decisionLogId ?? null,
        completedTrades,
        minTradesForTrust: GOAL_MIN_TRADES_FOR_TRUST,
        symbol: candidate.symbol,
        side: candidate.side,
        reason: candidate.reason,
        notionalUsd: forceMax ? config.maxNotionalUsd : undefined,
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

      const previewFingerprint = buildPreviewFingerprint({
        symbol: preview.symbol,
        side: preview.side,
        notionalUsd: preview.notionalUsd,
        reason: candidate.reason,
      });
      const hardSafety = checkOrderHardSafety({
        previewId: preview.previewId,
        symbol: preview.symbol,
        side: preview.side,
        doubleConfirm: true,
        submittedPreviewIds,
        previewFingerprint,
        recentPreviewFingerprints,
      });
      if (!hardSafety.allowed) {
        blockReasons.push(hardSafety.reason);
        await recordLoopGuardAction({
          actionType: "BINANCE_PREVIEW",
          actionKey: `hard-safety:${hardSafety.violation}`,
          success: false,
          failed: true,
          tradeCandidateKey: candidateKey,
          previewFingerprint,
          previewId: preview.previewId,
          runId: input.runId ?? null,
          summary: `${hardSafety.violation}: ${hardSafety.reason}`,
        });
        continue;
      }
      recentPreviewFingerprints.push(previewFingerprint);

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

    const loopBlocked = blockReasons.some((r) =>
      r.includes("Duplicate") || r.includes("loop guard"),
    );

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
      outcome: loopBlocked ? "LOOP_GUARD_BLOCKED" : "EXECUTE_BLOCKED",
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
