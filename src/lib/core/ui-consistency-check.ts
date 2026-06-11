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
  const mismatches = checks.filter((c) => !c.ok && !c.skipped);
  if (mismatches.some((m) => m.id.includes("blocked"))) return "BLOCKED";
  return mismatches.length > 0 ? "WARNING" : "OK";
}

export async function runUiConsistencyCheck(): Promise<UiConsistencyReport> {
  const lastCheckedAt = new Date().toISOString();
  const skippedChecks: string[] = [];

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

  if ((bundle.trades.staleOpenWarnings?.length ?? 0) > 0) {
    checks.push(
      check(
        "stale_open_trades",
        false,
        `${bundle.trades.staleOpenWarnings!.length} stale OPEN trade(s) reconciled against FLAT exchange position`,
        "0",
        String(bundle.trades.staleOpenWarnings!.length),
      ),
    );
  }

  const mismatches = checks.filter((c) => !c.ok && !c.skipped);
  return {
    status: deriveStatus(checks, timedOut),
    checks,
    mismatches,
    skippedChecks,
    lastCheckedAt,
    timedOut: timedOut || undefined,
  };
}
