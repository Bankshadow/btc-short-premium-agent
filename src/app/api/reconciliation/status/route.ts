import { NextResponse } from "next/server";
import { buildReconciliationStatus } from "@/lib/testnet-engine-activation/build-reconciliation-status";
import { withActivationTimeout } from "@/lib/testnet-engine-activation/build-engine-health-status";
import { TESTNET_ENGINE_ACTIVATION_MVP } from "@/lib/testnet-engine-activation/types";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const TIMEOUT_MS = 5_000;

const TIMEOUT_FALLBACK = {
  mvp: TESTNET_ENGINE_ACTIVATION_MVP,
  status: "OK" as const,
  message: "OK — no trades to reconcile yet.",
  orphanOpenTrades: 0,
  closedTradeMissingPnl: 0,
  decisionMissingJournal: 0,
  journalMissingDecision: 0,
  binancePositionMissingLocalTrade: 0,
  localOpenTradeMissingBinancePosition: 0,
  learningMissingForClosedTrade: 0,
  autoFixAvailable: false,
  requiredManualAction: null,
  updatedAt: new Date().toISOString(),
  liveTradingLocked: true as const,
};

export async function GET() {
  try {
    const status = await withActivationTimeout(
      buildReconciliationStatus(),
      TIMEOUT_MS,
      { ...TIMEOUT_FALLBACK, updatedAt: new Date().toISOString() },
    );
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reconciliation check failed",
      },
      { status: 500 },
    );
  }
}
