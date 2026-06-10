import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  blockBinanceProductionOrder,
  isBinanceForceMaxAutopilotEnabled,
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "./binance-config";
import { GOAL_MIN_TRADES_FOR_TRUST, GOAL_START_CAPITAL } from "@/lib/goal-engine/types";
import {
  dailyLossLimitHit,
  deriveMissionNextAction,
} from "@/lib/mission-controller-risk-budget/resolve-mission-mode";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import { loadServerBinanceTestnetJournal } from "./binance-testnet-journal-server";
import { buildBinancePreviewInputFromAiSignal } from "./build-ai-preview";
import { buildOrderPreview } from "./binance-order-preview";
import { executeBinanceTestnetOrder } from "./binance-execution";
import { getBinanceStatus, getPositions } from "./binance-futures-testnet";
import { pickAutopilotTradeCandidates } from "./pick-autopilot-symbols";
import { recordAutopilotCycleOutcome } from "./symbol-rotation-store";
import { evaluateUnifiedTestnetTradeGate } from "./unified-testnet-trade-gate";
import { resolveTestnetExecutionVerdict } from "./resolve-testnet-execution-verdict";
import { buildMonitorReliabilitySnapshot } from "@/lib/monitor-reliability";
import { buildIntegratedStrategyHealth } from "@/lib/integrated-strategy-health";
import { buildEvidenceProgress } from "@/lib/evidence-progress";
import { buildEvidenceQualitySnapshot } from "@/lib/evidence-quality/build-evidence-quality";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { loadTradeQualityStore } from "@/lib/trade-quality-score/quality-store";
import { buildClosedTradesFromJournal } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";

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

  const verdict = resolveTestnetExecutionVerdict(input.analysis);

  try {
    const status = await getBinanceStatus();
    if (!status.connected) {
      return {
        ...base,
        outcome: "NOT_CONNECTED",
        summary: status.error ?? "Binance testnet not connected.",
      };
    }

    const positions = await getPositions();
    const journalForReliability = await loadServerBinanceTestnetJournal().catch(() => []);
    const monitorReliability = await buildMonitorReliabilitySnapshot({
      journal: journalForReliability,
      positions,
      connected: true,
      autoExecuteEnabled: true,
      autoRecover: false,
    });

    const closedTrades = buildClosedTradesFromJournal(journalForReliability);
    const learningRecords = await loadLearningRecordsServer().catch(() => []);
    const [monitorEvents, qualityStore] = await Promise.all([
      loadMonitorJournalEvents().catch(() => []),
      loadTradeQualityStore().catch(() => ({ scores: [] })),
    ]);
    const evidenceProgress = buildEvidenceProgress({
      journal: journalForReliability,
      closedTrades,
      learningRecords,
      openPositionCount: positions.filter((p) => Math.abs(Number(p.positionAmt)) > 0)
        .length,
      connected: true,
    });
    const evidenceQuality = buildEvidenceQualitySnapshot({
      journal: journalForReliability,
      closedTrades,
      learningRecords,
      decisions: input.entries ?? [],
      tradeQualityScores: qualityStore.scores ?? [],
      monitorEvents,
    });
    const integratedStrategyHealth = await buildIntegratedStrategyHealth({
      journal: journalForReliability,
      closedTrades,
      learningRecords,
      decisions: input.entries ?? [],
      evidenceCompletedTrades: evidenceQuality.validEvidenceCount,
      evidenceValidTrades: evidenceProgress.validTrades,
      persistSideEffects: false,
      evidenceQuality,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dailyPnlUsd = journalForReliability
      .filter(
        (j) =>
          j.status === "CLOSED" &&
          new Date(j.closedAt ?? j.createdAt).getTime() >= todayStart.getTime(),
      )
      .reduce((sum, j) => sum + (j.realizedPnl ?? 0), 0);
    const netPnlUsd = journalForReliability
      .filter((j) => j.status === "CLOSED")
      .reduce((sum, j) => sum + (j.realizedPnl ?? 0), 0);
    const equityUsd = GOAL_START_CAPITAL + netPnlUsd;
    const dailyPnlPct =
      equityUsd > 0 ? (dailyPnlUsd / equityUsd) * 100 : 0;
    const missionMode = dailyLossLimitHit(dailyPnlPct) ? "PAUSED" : null;
    const missionNextAction =
      missionMode === "PAUSED"
        ? deriveMissionNextAction({
            missionMode: "PAUSED",
            progressPct: 0,
            modeReason: "Daily loss limit hit.",
          })
        : null;

    const tradeGate = evaluateUnifiedTestnetTradeGate({
      analysis: input.analysis,
      commandCenterStatus: input.commandCenterStatus ?? null,
      entries: input.entries,
      orders: input.orders,
      monitorReliability,
      integratedStrategyHealth,
      consistencyBlocksNewTrades: monitorReliability?.positionStateUncertain ?? false,
      consistencyIssue: monitorReliability?.currentIssue ?? null,
      missionMode,
      missionNextAction,
    });
    if (!tradeGate.allowed) {
      return {
        ...base,
        outcome: "STRATEGY_BLOCKED",
        blockReasons: tradeGate.blockReasons,
        summary: tradeGate.blockReasons[0] ?? "Unified trade gate blocked new entries.",
      };
    }

    const openSymbols = positions
      .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
      .map((p) => p.symbol);

    const journal = await loadServerBinanceTestnetJournal().catch(() => []);
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
          embeddedPreview: preview,
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
