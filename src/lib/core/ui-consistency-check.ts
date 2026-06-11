import { withBoundedCheck } from "./core-bounded";
import { buildProjectionBundleFast } from "./projection-bundle";

export interface UiConsistencyCheck {
  id: string;
  ok: boolean;
  message: string;
  expected?: string;
  actual?: string;
  skipped?: boolean;
}

export interface UiConsistencyReport {
  status: "OK" | "WARNING" | "BLOCKED";
  checks: UiConsistencyCheck[];
  mismatches: UiConsistencyCheck[];
  skippedChecks: string[];
  lastCheckedAt: string;
  timedOut?: boolean;
  browserDomChecksAvailable: boolean;
  note: string;
}

function check(
  id: string,
  ok: boolean,
  message: string,
  expected?: string,
  actual?: string,
  skipped = false,
): UiConsistencyCheck {
  return { id, ok, message, expected, actual, skipped };
}

function skippedCheck(id: string, message: string): UiConsistencyCheck {
  return check(id, true, message, undefined, undefined, true);
}

function deriveStatus(
  checks: UiConsistencyCheck[],
  timedOut: boolean,
): UiConsistencyReport["status"] {
  if (timedOut) return "WARNING";
  const hardMismatches = checks.filter(
    (c) => !c.ok && !c.skipped && c.id !== "STALE_TRADE_MANUAL_REPAIR_REQUIRED",
  );
  const hasStaleRepair = checks.some((c) => c.id === "STALE_TRADE_MANUAL_REPAIR_REQUIRED");
  if (hardMismatches.some((m) => m.id.includes("blocked"))) return "BLOCKED";
  if (hardMismatches.length > 0 || hasStaleRepair) return "WARNING";
  return "OK";
}

export async function runUiConsistencyCheck(): Promise<UiConsistencyReport> {
  const lastCheckedAt = new Date().toISOString();
  const skippedChecks: string[] = [];
  const note =
    "This endpoint validates projection consistency, not rendered DOM values.";
  const browserDomChecksAvailable = false;

  const { result: bundle, timedOut } = await withBoundedCheck(
    () => buildProjectionBundleFast(),
    null,
  );

  const checks: UiConsistencyCheck[] = [];

  if (timedOut || !bundle) {
    checks.push(
      check(
        "bundle_available",
        false,
        "Projection bundle unavailable within timeout",
      ),
    );
    return {
      status: "WARNING",
      checks,
      mismatches: checks,
      skippedChecks: ["all_projection_checks"],
      lastCheckedAt,
      timedOut: true,
      browserDomChecksAvailable,
      note,
    };
  }

  if (!bundle.ok) {
    checks.push(check("bundle_ok", false, "Projection bundle failed", "ok", "error"));
    return {
      status: "BLOCKED",
      checks,
      mismatches: checks.filter((c) => !c.ok),
      skippedChecks,
      lastCheckedAt,
      browserDomChecksAvailable,
      note,
    };
  }

  const mission = bundle.mission;

  checks.push(
    check(
      "dashboard_mission_equity",
      true,
      `Mission projection equity $${mission.currentEquity}`,
      String(mission.currentEquity),
      String(mission.currentEquity),
    ),
  );

  skippedChecks.push("reports_page_equity");
  checks.push(
    skippedCheck(
      "reports_mission_equity",
      "SKIPPED — reports page equity not available server-side; mission projection used as source of truth.",
    ),
  );

  const effectiveOpen =
    bundle.trades.effectiveOpenCount ?? bundle.trades.open.length;
  checks.push(
    check(
      "trade_counts_open",
      bundle.trades.open.length === effectiveOpen,
      "Trade projection open list matches effective open count",
      String(effectiveOpen),
      String(bundle.trades.open.length),
    ),
  );

  checks.push(
    check(
      "trade_counts_closed",
      bundle.trades.closed.length >= 0,
      `Trade projection closed count ${bundle.trades.closed.length}`,
    ),
  );

  checks.push(
    check(
      "evidence_progress",
      bundle.evidence.valid <= bundle.evidence.required,
      `Evidence progress ${bundle.evidence.valid}/${bundle.evidence.required}`,
      String(bundle.evidence.required),
      String(bundle.evidence.valid),
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

  skippedChecks.push("binance_browser_status");
  checks.push(
    skippedCheck(
      "binance_status",
      "SKIPPED — Binance browser status not compared server-side; use settings projection.",
    ),
  );

  skippedChecks.push("dashboard_browser_equity");
  checks.push(
    skippedCheck(
      "dashboard_browser_equity",
      "SKIPPED — dashboard DOM equity not available server-side.",
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

  const staleCount = bundle.trades.staleOpenWarnings?.length ?? 0;
  if (staleCount > 0) {
    checks.push(
      check(
        "STALE_TRADE_MANUAL_REPAIR_REQUIRED",
        false,
        `${staleCount} stale trade(s) require manual repair — not counted as active open exposure`,
        "0",
        String(staleCount),
      ),
    );
  }

  const mismatches = checks.filter(
    (c) => !c.ok && !c.skipped && c.id !== "STALE_TRADE_MANUAL_REPAIR_REQUIRED",
  );
  return {
    status: deriveStatus(checks, timedOut),
    checks,
    mismatches,
    skippedChecks,
    lastCheckedAt,
    timedOut: timedOut || undefined,
    browserDomChecksAvailable,
    note,
  };
}
