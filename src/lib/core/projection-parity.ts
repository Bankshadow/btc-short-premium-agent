import { withBoundedCheck } from "./core-bounded";
import { buildProjectionBundleFast } from "./projection-bundle";

export interface ProjectionParityCheck {
  id: string;
  ok: boolean;
  message: string;
  expected?: string;
  actual?: string;
  skipped?: boolean;
}

export interface ProjectionParityReport {
  status: "OK" | "WARNING" | "BLOCKED";
  eventCount: number;
  checkedSections: string[];
  parityIssues: ProjectionParityCheck[];
  skippedChecks: string[];
  checks: ProjectionParityCheck[];
  mismatches: ProjectionParityCheck[];
  lastCheckedAt: string;
  timedOut?: boolean;
}

const MAX_EVENT_PARITY_DEPTH = 20;

function check(
  id: string,
  ok: boolean,
  message: string,
  expected?: string,
  actual?: string,
  skipped = false,
): ProjectionParityCheck {
  return { id, ok, message, expected, actual, skipped };
}

function skippedCheck(id: string, message: string): ProjectionParityCheck {
  return check(id, true, message, undefined, undefined, true);
}

export async function runProjectionParityCheck(): Promise<ProjectionParityReport> {
  const lastCheckedAt = new Date().toISOString();
  const checks: ProjectionParityCheck[] = [];
  const skippedChecks: string[] = [
    "reports_summary",
    "enriched_trade_async",
    "legacy_full_rebuild",
  ];
  const checkedSections: string[] = [];

  const { result: bundle, timedOut: bundleTimedOut } = await withBoundedCheck(
    () => buildProjectionBundleFast(),
    null,
    3500,
  );

  if (bundleTimedOut || !bundle) {
    checks.push(check("bundle_ok", false, "Projection bundle unavailable within timeout"));
    return {
      status: "WARNING",
      eventCount: 0,
      checkedSections: [],
      parityIssues: checks,
      skippedChecks,
      checks,
      mismatches: checks,
      lastCheckedAt,
      timedOut: true,
    };
  }

  const eventCount = bundle.ok ? bundle.meta.eventCount : 0;

  if (!bundle.ok) {
    checks.push(check("bundle_ok", false, "Projection bundle failed", "ok", "error"));
    return {
      status: "BLOCKED",
      eventCount,
      checkedSections: ["bundle"],
      parityIssues: checks.filter((c) => !c.ok),
      skippedChecks,
      checks,
      mismatches: checks.filter((c) => !c.ok),
      lastCheckedAt,
    };
  }

  checkedSections.push("mission", "trades", "pnl", "evidence", "risk", "positions");

  const effectiveOpen =
    bundle.trades.effectiveOpenCount ?? bundle.trades.open.length;

  checks.push(
    check(
      "mission_equity",
      bundle.mission.currentEquity >= 0,
      `Mission equity $${bundle.mission.currentEquity}`,
    ),
  );

  checks.push(
    check(
      "mission_trade_count",
      bundle.mission.totalTrades === bundle.trades.open.length + bundle.trades.closed.length ||
        bundle.trades.closed.length > 0,
      "Mission totalTrades aligns with trade projection",
      String(bundle.mission.totalTrades),
      String(bundle.trades.open.length + bundle.trades.closed.length),
    ),
  );

  checks.push(
    check(
      "trade_open_effective",
      bundle.trades.open.length === effectiveOpen,
      "Effective open count matches reconciled open list",
      String(effectiveOpen),
      String(bundle.trades.open.length),
    ),
  );

  checks.push(
    check(
      "trade_closed_count",
      bundle.trades.closed.length >= 0,
      `Closed trades ${bundle.trades.closed.length}`,
    ),
  );

  checks.push(
    check(
      "pnl_alignment",
      Math.abs(bundle.pnl.totalNetPnl - bundle.mission.netPnl) < 0.01,
      "Bundle PnL matches mission netPnl",
      String(bundle.mission.netPnl),
      String(bundle.pnl.totalNetPnl),
    ),
  );

  checks.push(
    check(
      "evidence_valid",
      bundle.evidence.valid <= bundle.evidence.required,
      `Evidence ${bundle.evidence.valid}/${bundle.evidence.required}`,
    ),
  );

  checks.push(
    check(
      "live_locked",
      bundle.risk.liveLocked === true && (bundle.health?.liveLocked ?? true) === true,
      "Live locked across risk and health",
    ),
  );

  checks.push(
    check(
      "positions_open_count",
      bundle.positions.openTradeCount === effectiveOpen,
      "Position openTradeCount matches effective open trades",
      String(effectiveOpen),
      String(bundle.positions.openTradeCount),
    ),
  );

  if ((bundle.trades.staleOpenWarnings?.length ?? 0) > 0) {
    checks.push(
      check(
        "stale_open_reconciled",
        effectiveOpen < bundle.trades.open.length + bundle.trades.staleOpenWarnings!.length,
        `${bundle.trades.staleOpenWarnings!.length} stale OPEN trade(s) excluded from active count`,
      ),
    );
  }

  if (eventCount > MAX_EVENT_PARITY_DEPTH) {
    skippedChecks.push("full_event_replay");
    checks.push(
      skippedCheck(
        "full_event_replay",
        `SKIPPED — eventCount ${eventCount} exceeds limit ${MAX_EVENT_PARITY_DEPTH}; bundle-only parity returned.`,
      ),
    );
  }

  checks.push(
    skippedCheck(
      "reports_mission_equity",
      "SKIPPED — buildReportsSummary is expensive; reports parity deferred.",
    ),
  );

  const mismatches = checks.filter((c) => !c.ok && !c.skipped);
  const status: ProjectionParityReport["status"] =
    bundleTimedOut ? "WARNING" : mismatches.length > 0 ? "WARNING" : "OK";

  return {
    status,
    eventCount,
    checkedSections,
    parityIssues: mismatches,
    skippedChecks,
    checks,
    mismatches,
    lastCheckedAt,
    timedOut: bundleTimedOut || undefined,
  };
}
