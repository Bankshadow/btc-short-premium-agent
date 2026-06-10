import type { AnalyzeApiResponse } from "@/lib/types/market";
import { getTestnetMonitorSettings } from "@/lib/desk/desk-risk-policy";
import {
  buildMonitorReliabilitySnapshot,
  recordMonitorCycleHeartbeat,
} from "@/lib/monitor-reliability";
import type { MonitorReliabilitySnapshot } from "@/lib/monitor-reliability/types";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";
import {
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "./binance-config";
import { executeBinanceTestnetClose } from "./binance-execution";
import { backfillOrphanBinanceJournalEntries } from "./binance-journal-backfill";
import {
  findOpenJournalEntryForSymbol,
  persistReconciledBinanceJournal,
} from "./binance-journal-reconcile";
import { getBinanceStatus, getPositions } from "./binance-futures-testnet";
import {
  loadServerBinanceTestnetJournal,
  saveServerBinanceTestnetJournal,
} from "./binance-testnet-journal-server";
import { resolveTestnetExecutionVerdict } from "./resolve-testnet-execution-verdict";

export const TESTNET_AUTO_MONITOR_DEFAULTS = {
  stopLossPct: -2,
  takeProfitPct: 3,
  maxHoldHours: 24,
  verdictFlipGraceHours: 1,
};

export type BinanceAutoMonitorOutcome =
  | "DISABLED"
  | "NOT_CONNECTED"
  | "NO_POSITION"
  | "HOLD"
  | "CLOSED"
  | "CLOSE_BLOCKED"
  | "ERROR";

export type { MonitorReliabilitySnapshot };

export interface BinanceAutoMonitorResult {
  outcome: BinanceAutoMonitorOutcome;
  summary: string;
  symbol: string | null;
  closeReason: string | null;
  monitoredCount: number;
  closedCount: number;
  reliability: MonitorReliabilitySnapshot | null;
}

function unrealizedPct(
  entryPrice: number,
  markPrice: number,
  positionAmt: number,
): number {
  if (entryPrice <= 0 || markPrice <= 0) return 0;
  const isLong = positionAmt > 0;
  const raw = isLong
    ? ((markPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - markPrice) / entryPrice) * 100;
  return Number(raw.toFixed(3));
}

function resolveCloseReason(input: {
  uPnLPct: number;
  verdict: string;
  openedHours: number;
}): string | null {
  const settings = getTestnetMonitorSettings();
  if (input.uPnLPct <= settings.stopLossPct) {
    return `Stop loss ${settings.stopLossPct}% (uPnL ${input.uPnLPct}%)`;
  }
  if (input.uPnLPct >= settings.takeProfitPct) {
    return `Take profit +${settings.takeProfitPct}% (uPnL ${input.uPnLPct}%)`;
  }
  if (
    input.openedHours >= settings.verdictFlipGraceHours &&
    (input.verdict === "SKIP" ||
      input.verdict === "WAIT" ||
      input.verdict === "LONG")
  ) {
    return `Committee ${input.verdict} — thesis no longer active`;
  }
  if (input.openedHours >= settings.maxHoldHours) {
    return `Max hold ${settings.maxHoldHours}h reached`;
  }
  return null;
}

function resultBase() {
  return {
    symbol: null as string | null,
    closeReason: null as string | null,
    monitoredCount: 0,
    closedCount: 0,
    reliability: null as MonitorReliabilitySnapshot | null,
  };
}

/**
 * Monitors all open testnet futures positions and auto-closes when SL/TP,
 * verdict flip, or max hold time is hit. Testnet-only; requires auto-execute mode.
 */
export async function runBinanceTestnetAutoMonitor(input: {
  analysis: AnalyzeApiResponse | null;
  runId?: string | null;
}): Promise<BinanceAutoMonitorResult> {
  const base = resultBase();

  if (!isBinanceTestnetAutoExecuteEnabled()) {
    return {
      ...base,
      outcome: "DISABLED",
      summary: "Testnet auto-monitor disabled (BINANCE_TESTNET_AUTOEXECUTE_ENABLED).",
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

  try {
    const status = await getBinanceStatus();
    if (!status.connected) {
      return {
        ...base,
        outcome: "NOT_CONNECTED",
        summary: status.error ?? "Binance testnet not connected.",
      };
    }

    const positionRefreshAt = new Date().toISOString();
    let positions = await getPositions();
    let journal = await loadServerBinanceTestnetJournal().catch(() => []);

    let reliability = await buildMonitorReliabilitySnapshot({
      journal,
      positions,
      connected: true,
      autoExecuteEnabled: true,
      runId: input.runId ?? null,
      autoRecover: true,
    });
    journal = await loadServerBinanceTestnetJournal().catch(() => journal);

    const open = positions.filter((p) => Math.abs(Number(p.positionAmt)) > 0);
    if (open.length === 0) {
    await recordMonitorCycleHeartbeat({
      runId: input.runId,
      positionRefreshAt,
      closeCheckAt: positionRefreshAt,
      journalWriteAt: reliability.recoveredCount > 0 ? new Date().toISOString() : undefined,
    });
    await (
      await import("@/lib/engine-consistency/run-recommended-consistency-auto-fix")
    )
      .runRecommendedConsistencyAutoFixFromAutomation()
      .catch(() => null);
    reliability = await buildMonitorReliabilitySnapshot({
        journal,
        positions: [],
        connected: true,
        autoExecuteEnabled: true,
        runId: input.runId ?? null,
        autoRecover: false,
      });
      return {
        ...base,
        outcome: "NO_POSITION",
        summary: "No open testnet positions to monitor.",
        reliability,
      };
    }

    const backfill = backfillOrphanBinanceJournalEntries({
      positions: open,
      journal,
    });
    if (backfill.backfilledSymbols.length > 0) {
      journal = backfill.journal;
      await saveServerBinanceTestnetJournal(journal);
    }

    const verdict = resolveTestnetExecutionVerdict(input.analysis);
    const summaries: string[] = [];
    let closedCount = 0;
    let lastCloseReason: string | null = null;
    let lastClosedSymbol: string | null = null;
    const closeCheckAt = new Date().toISOString();
    let journalWriteAt: string | undefined;

    for (const pos of open) {
      const mark = Number(pos.markPrice);
      const entry = Number(pos.entryPrice);
      const amt = Number(pos.positionAmt);
      const uPnLPct = unrealizedPct(entry, mark, amt);
      const openTrade = findOpenJournalEntryForSymbol(journal, pos.symbol);
      const closingEntry = journal.find(
        (j) => j.symbol === pos.symbol && j.status === "CLOSING",
      );

      if (closingEntry) {
        summaries.push(`Hold ${pos.symbol} · close in progress`);
        continue;
      }

      if (openTrade?.closeAttempt && openTrade.closeFailed) {
        summaries.push(`${pos.symbol}: prior close failed — no blind retry`);
        continue;
      }

      const openedAt = openTrade?.executedAt ?? openTrade?.createdAt ?? null;
      const openedHours = openedAt
        ? (Date.now() - Date.parse(openedAt)) / 3_600_000
        : 0;

      const closeReason = resolveCloseReason({
        uPnLPct,
        verdict,
        openedHours,
      });

      if (!closeReason) {
        summaries.push(
          `Hold ${pos.symbol} · uPnL ${uPnLPct >= 0 ? "+" : ""}${uPnLPct}%`,
        );
        continue;
      }

      const close = await executeBinanceTestnetClose({
        close: {
          symbol: pos.symbol,
          doubleConfirm: true,
          operatorNote: `Autonomous testnet monitor — ${closeReason}`,
        },
      });

      if (close.blocked || !close.ok) {
        summaries.push(`${pos.symbol}: close blocked`);
        await recordMonitorCycleHeartbeat({
          runId: input.runId,
          positionRefreshAt,
          closeCheckAt,
        });
        reliability = await buildMonitorReliabilitySnapshot({
          journal: await loadServerBinanceTestnetJournal().catch(() => journal),
          positions,
          connected: true,
          autoExecuteEnabled: true,
          runId: input.runId ?? null,
          autoRecover: false,
        });
        return {
          symbol: pos.symbol,
          closeReason,
          monitoredCount: open.length,
          closedCount,
          outcome: "CLOSE_BLOCKED",
          summary: close.error ?? "Auto-close blocked by risk gate.",
          reliability,
        };
      }

      closedCount += 1;
      lastCloseReason = closeReason;
      lastClosedSymbol = pos.symbol;
      summaries.push(`Closed ${pos.symbol} — ${closeReason}`);
      journalWriteAt = new Date().toISOString();

      void emitMissionAlert({
        kind: "trade_closed",
        title: "Autopilot closed testnet position",
        body: `${pos.symbol} · ${closeReason}`,
      });
    }

    if (closedCount > 0) {
      positions = await getPositions().catch(() => positions);
      journal = await persistReconciledBinanceJournal({
        journal: await loadServerBinanceTestnetJournal().catch(() => journal),
        positions,
      });
      journalWriteAt = new Date().toISOString();

      await (
        await import("@/lib/testnet-monitor/build-testnet-monitor-snapshot")
      )
        .buildTestnetMonitorSnapshot({ fresh: true })
        .catch(() => null);
      await (
        await import("@/lib/testnet-monitor/learning-records-server")
      )
        .autoMarkPendingLearningRecordsServer()
        .catch(() => null);
    }

    await recordMonitorCycleHeartbeat({
      runId: input.runId,
      positionRefreshAt,
      closeCheckAt,
      journalWriteAt,
    });

    const autoFixOutcome = await (
      await import("@/lib/engine-consistency/run-recommended-consistency-auto-fix")
    )
      .runRecommendedConsistencyAutoFixFromAutomation()
      .catch(() => null);
    if (autoFixOutcome && autoFixOutcome.appliedCount > 0) {
      journal = await loadServerBinanceTestnetJournal().catch(() => journal);
      positions = await getPositions().catch(() => positions);
    }

    reliability = await buildMonitorReliabilitySnapshot({
      journal,
      positions,
      connected: true,
      autoExecuteEnabled: true,
      runId: input.runId ?? null,
      autoRecover: false,
    });

    if (closedCount > 0) {
      return {
        symbol: lastClosedSymbol,
        closeReason: lastCloseReason,
        monitoredCount: open.length,
        closedCount,
        outcome: "CLOSED",
        summary: summaries.join(" · "),
        reliability,
      };
    }

    return {
      symbol: open[0]?.symbol ?? null,
      closeReason: null,
      monitoredCount: open.length,
      closedCount: 0,
      outcome: "HOLD",
      summary: summaries.join(" · "),
      reliability,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-monitor failed";
    return {
      ...base,
      outcome: "ERROR",
      summary: message,
    };
  }
}
