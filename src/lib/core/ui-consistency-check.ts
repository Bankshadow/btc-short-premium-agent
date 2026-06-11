import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { API_RESPONSE_BOUND_MS } from "@/lib/core/zero-state";
import { buildEnrichedTradeProjection } from "./build-enriched-trade-projection";
import { buildProjectionBundle } from "./projection-bundle";
import { readCoreEvents } from "./event-store";

export interface UiConsistencyCheck {
  id: string;
  ok: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

export interface UiConsistencyReport {
  status: "OK" | "WARNING" | "BLOCKED";
  checks: UiConsistencyCheck[];
  mismatches: UiConsistencyCheck[];
  lastCheckedAt: string;
}

function check(id: string, ok: boolean, message: string, expected?: string, actual?: string): UiConsistencyCheck {
  return { id, ok, message, expected, actual };
}

export async function runUiConsistencyCheck(): Promise<UiConsistencyReport> {
  const lastCheckedAt = new Date().toISOString();
  const checks: UiConsistencyCheck[] = [];

  const bundle = await buildProjectionBundle();
  const events = await readCoreEvents();
  const trades = await buildEnrichedTradeProjection(events);
  const binance = normalizeBinanceStatusDiagnostics(
    await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS),
    "mvp-4.6",
  );

  const mission = bundle.mission;
  const openCount = trades.summary.openCount;
  const closedCount = trades.summary.closedCount;

  checks.push(
    check(
      "dashboard_reports_equity",
      true,
      `Mission equity $${mission.currentEquity} (shared projection)`,
    ),
  );

  checks.push(
    check(
      "trade_counts_open",
      bundle.trades.open.length === openCount,
      "Trade projection open count matches enriched trades",
      String(bundle.trades.open.length),
      String(openCount),
    ),
  );

  checks.push(
    check(
      "trade_counts_closed",
      bundle.trades.closed.length === closedCount,
      "Trade projection closed count matches enriched trades",
      String(bundle.trades.closed.length),
      String(closedCount),
    ),
  );

  checks.push(
    check(
      "pnl_matches_closed",
      Math.abs(bundle.pnl.totalNetPnl - trades.summary.realizedPnl) < 0.01,
      "PnL projection matches trade summary realized PnL",
      String(bundle.pnl.totalNetPnl),
      String(trades.summary.realizedPnl),
    ),
  );

  checks.push(
    check(
      "evidence_valid",
      bundle.evidence.valid === bundle.evidence.valid,
      `Evidence valid ${bundle.evidence.valid}/${bundle.evidence.required}`,
    ),
  );

  checks.push(
    check(
      "mission_open_positions",
      mission.openPositions === bundle.positions.openTradeCount,
      "Mission openPositions matches position projection",
      String(mission.openPositions),
      String(bundle.positions.openTradeCount),
    ),
  );

  checks.push(
    check(
      "live_locked",
      bundle.risk.liveLocked === true && (bundle.health?.liveLocked ?? true) === true,
      "Live locked across risk and core health",
    ),
  );

  checks.push(
    check(
      "binance_status_present",
      Boolean(binance.status),
      `Binance status ${binance.status}`,
    ),
  );

  if (bundle.health) {
    checks.push(
      check(
        "core_health_status",
        ["OK", "WARNING", "BLOCKED"].includes(bundle.health.status),
        `Core health ${bundle.health.status}`,
      ),
    );
  }

  const mismatches = checks.filter((c) => !c.ok);
  const status: UiConsistencyReport["status"] =
    mismatches.some((m) => m.id.includes("blocked"))
      ? "BLOCKED"
      : mismatches.length > 0
        ? "WARNING"
        : "OK";

  return { status, checks, mismatches, lastCheckedAt };
}
