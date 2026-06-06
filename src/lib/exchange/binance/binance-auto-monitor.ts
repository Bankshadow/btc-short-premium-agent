import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
} from "./binance-config";
import { executeBinanceTestnetClose } from "./binance-execution";
import { getBinanceStatus, getPositions } from "./binance-futures-testnet";

export const TESTNET_AUTO_MONITOR_DEFAULTS = {
  stopLossPct: -2,
  takeProfitPct: 3,
  maxHoldHours: 24,
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
  if (input.uPnLPct <= TESTNET_AUTO_MONITOR_DEFAULTS.stopLossPct) {
    return `Stop loss ${TESTNET_AUTO_MONITOR_DEFAULTS.stopLossPct}% (uPnL ${input.uPnLPct}%)`;
  }
  if (input.uPnLPct >= TESTNET_AUTO_MONITOR_DEFAULTS.takeProfitPct) {
    return `Take profit +${TESTNET_AUTO_MONITOR_DEFAULTS.takeProfitPct}% (uPnL ${input.uPnLPct}%)`;
  }
  if (
    input.verdict === "SKIP" ||
    input.verdict === "WAIT" ||
    input.verdict === "LONG"
  ) {
    return `Committee ${input.verdict} — thesis no longer active`;
  }
  if (input.openedHours >= TESTNET_AUTO_MONITOR_DEFAULTS.maxHoldHours) {
    return `Max hold ${TESTNET_AUTO_MONITOR_DEFAULTS.maxHoldHours}h reached`;
  }
  return null;
}

/**
 * Monitors open testnet futures positions and auto-closes when SL/TP,
 * verdict flip, or max hold time is hit. Testnet-only; requires auto-execute mode.
 */
export async function runBinanceTestnetAutoMonitor(input: {
  analysis: AnalyzeApiResponse | null;
}): Promise<BinanceAutoMonitorResult> {
  const base = {
    symbol: null as string | null,
    closeReason: null as string | null,
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

    const verdict = committeeVerdict(input.analysis);
    const pos = open[0];
    const mark = Number(pos.markPrice);
    const entry = Number(pos.entryPrice);
    const amt = Number(pos.positionAmt);
    const uPnLPct = unrealizedPct(entry, mark, amt);
    const openedHours = 0;

    const closeReason = resolveCloseReason({
      uPnLPct,
      verdict,
      openedHours,
    });

    if (!closeReason) {
      return {
        ...base,
        symbol: pos.symbol,
        outcome: "HOLD",
        summary: `Holding ${pos.symbol} · uPnL ${uPnLPct >= 0 ? "+" : ""}${uPnLPct}% · verdict ${verdict}`,
      };
    }

    const close = await executeBinanceTestnetClose({
      close: {
        symbol: pos.symbol,
        doubleConfirm: true,
        operatorNote: `Autonomous testnet monitor — ${closeReason}`,
      },
    });

    if (close.blocked || !close.ok) {
      return {
        symbol: pos.symbol,
        closeReason,
        outcome: "CLOSE_BLOCKED",
        summary: close.error ?? "Auto-close blocked by risk gate.",
      };
    }

    return {
      symbol: pos.symbol,
      closeReason,
      outcome: "CLOSED",
      summary: `Closed ${pos.symbol} — ${closeReason}`,
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
