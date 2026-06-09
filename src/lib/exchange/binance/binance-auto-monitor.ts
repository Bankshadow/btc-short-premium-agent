import type { AnalyzeApiResponse } from "@/lib/types/market";
import { getTestnetMonitorSettings } from "@/lib/desk/desk-risk-policy";
import {
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "./binance-config";
import { executeBinanceTestnetClose } from "./binance-execution";
import { loadServerBinanceTestnetJournal, saveServerBinanceTestnetJournal } from "./binance-testnet-journal-server";
import { backfillOrphanBinanceJournalEntries } from "./binance-journal-backfill";
import { getBinanceStatus, getPositions } from "./binance-futures-testnet";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";

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

export interface BinanceAutoMonitorResult {
  outcome: BinanceAutoMonitorOutcome;
  summary: string;
  symbol: string | null;
  closeReason: string | null;
  monitoredCount: number;
  closedCount: number;
}

function committeeVerdict(data: AnalyzeApiResponse | null): string {
  const verdict =
    data?.tradingDesk?.weightedCommittee?.weightedVerdict ??
    data?.step5_verdict?.recommendation ??
    "WAIT";
  return String(verdict).toUpperCase();
}

function unrealizedPct(entryPrice: number, markPrice: number, positionAmt: number): number {
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

/**
 * Monitors all open testnet futures positions and auto-closes when SL/TP,
 * verdict flip, or max hold time is hit. Testnet-only; requires auto-execute mode.
 */
export async function runBinanceTestnetAutoMonitor(input: {
  analysis: AnalyzeApiResponse | null;
}): Promise<BinanceAutoMonitorResult> {
  const base = {
    symbol: null as string | null,
    closeReason: null as string | null,
    monitoredCount: 0,
    closedCount: 0,
  };

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

    const positions = await getPositions();
    const open = positions.filter((p) => Math.abs(Number(p.positionAmt)) > 0);
    if (open.length === 0) {
      return {
        ...base,
        outcome: "NO_POSITION",
        summary: "No open testnet positions to monitor.",
      };
    }

    let journal = await loadServerBinanceTestnetJournal().catch(() => []);
    const backfill = backfillOrphanBinanceJournalEntries({
      positions: open,
      journal,
    });
    if (backfill.backfilledSymbols.length > 0) {
      journal = backfill.journal;
      await saveServerBinanceTestnetJournal(journal);
    }

    const verdict = committeeVerdict(input.analysis);
    const summaries: string[] = [];
    let closedCount = 0;
    let lastCloseReason: string | null = null;
    let lastClosedSymbol: string | null = null;

    for (const pos of open) {
      const mark = Number(pos.markPrice);
      const entry = Number(pos.entryPrice);
      const amt = Number(pos.positionAmt);
      const uPnLPct = unrealizedPct(entry, mark, amt);
      const openTrade = journal.find(
        (j) =>
          j.symbol === pos.symbol &&
          ["SUBMITTED", "FILLED", "CLOSING"].includes(j.status),
      );
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
        return {
          symbol: pos.symbol,
          closeReason,
          monitoredCount: open.length,
          closedCount,
          outcome: "CLOSE_BLOCKED",
          summary: close.error ?? "Auto-close blocked by risk gate.",
        };
      }

      closedCount += 1;
      lastCloseReason = closeReason;
      lastClosedSymbol = pos.symbol;
      summaries.push(`Closed ${pos.symbol} — ${closeReason}`);

      void emitMissionAlert({
        kind: "trade_closed",
        title: "Autopilot closed testnet position",
        body: `${pos.symbol} · ${closeReason}`,
      });
    }

    if (closedCount > 0) {
      return {
        symbol: lastClosedSymbol,
        closeReason: lastCloseReason,
        monitoredCount: open.length,
        closedCount,
        outcome: "CLOSED",
        summary: summaries.join(" · "),
      };
    }

    return {
      symbol: open[0]?.symbol ?? null,
      closeReason: null,
      monitoredCount: open.length,
      closedCount: 0,
      outcome: "HOLD",
      summary: summaries.join(" · "),
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
