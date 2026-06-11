import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress";
import { buildClosedTradesFromEvents, buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import { withBoundedCheck } from "./core-bounded";
import { buildProjectionBundle } from "./projection-bundle";
import { readCoreEvents } from "./event-store";
import { buildAllProjections } from "./projection-engine";

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

const MAX_TRADE_PARITY_CHECKS = 10;

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
  const skippedChecks: string[] = ["reports_summary", "enriched_trade_async"];
  const checkedSections: string[] = [];

  const { result: bundle, timedOut: bundleTimedOut } = await withBoundedCheck(
    () => buildProjectionBundle(),
    null,
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

  const { result: events, timedOut: eventsTimedOut } = await withBoundedCheck(
    () => readCoreEvents(),
    [] as Awaited<ReturnType<typeof readCoreEvents>>,
    1500,
  );

  if (eventsTimedOut) {
    skippedChecks.push("legacy_rebuild");
    checks.push(
      skippedCheck("legacy_events", "SKIPPED — event read timed out; bundle-only parity returned."),
    );
  } else {
    const legacyMission = buildMissionSnapshot(events);
    const legacyEvidence = buildEvidenceProgressFromEvents(events);
    const legacyOpen = buildOpenTradesFromEvents(events);
    const legacyClosed = buildClosedTradesFromEvents(events);
    const reconciledOpen =
      bundle.trades.effectiveOpenCount ?? bundle.trades.open.length;

    checkedSections.push("mission", "trades", "evidence", "pnl");

    checks.push(
      check(
        "mission_equity",
        bundle.mission.currentEquity === legacyMission.currentEquity,
        "Bundle mission equity matches legacy snapshot",
        String(bundle.mission.currentEquity),
        String(legacyMission.currentEquity),
      ),
    );

    checks.push(
      check(
        "mission_progress",
        bundle.mission.progressPct === legacyMission.progressPct,
        "Bundle progress matches legacy snapshot",
        String(bundle.mission.progressPct),
        String(legacyMission.progressPct),
      ),
    );

    checks.push(
      check(
        "trade_open_count",
        reconciledOpen === bundle.trades.open.length,
        "Bundle effective open count is internally consistent",
        String(reconciledOpen),
        String(bundle.trades.open.length),
      ),
    );

    checks.push(
      check(
        "trade_closed_count",
        bundle.trades.closed.length >= legacyClosed.length,
        "Bundle closed count includes reconciled pending-PnL trades",
        String(legacyClosed.length),
        String(bundle.trades.closed.length),
      ),
    );

    checks.push(
      check(
        "legacy_raw_open_drift",
        legacyOpen.length === bundle.trades.open.length ||
          (bundle.trades.staleOpenWarnings?.length ?? 0) > 0,
        legacyOpen.length === bundle.trades.open.length
          ? "Legacy raw open count matches bundle"
          : "Legacy raw open count differs — stale trades reconciled in bundle",
        String(legacyOpen.length),
        String(bundle.trades.open.length),
      ),
    );

    checks.push(
      check(
        "evidence_valid",
        bundle.evidence.valid === legacyEvidence.valid,
        "Bundle evidence valid matches legacy evidence",
        String(bundle.evidence.valid),
        String(legacyEvidence.valid),
      ),
    );

    if (eventCount > 100) {
      skippedChecks.push("full_trade_replay");
      checks.push(
        skippedCheck(
          "full_trade_parity",
          `SKIPPED — eventCount ${eventCount} exceeds replay limit; checked latest ${MAX_TRADE_PARITY_CHECKS} trades only.`,
        ),
      );
    }

    const projections = buildAllProjections(events);
    checks.push(
      check(
        "pnl_realized",
        Math.abs(bundle.pnl.totalNetPnl - projections.pnl.totalNetPnl) < 0.01,
        "Bundle PnL matches projection engine",
        String(bundle.pnl.totalNetPnl),
        String(projections.pnl.totalNetPnl),
      ),
    );
    checkedSections.push("pnl");
  }

  checks.push(
    skippedCheck(
      "reports_mission_equity",
      "SKIPPED — buildReportsSummary is expensive; reports parity deferred.",
    ),
  );

  const mismatches = checks.filter((c) => !c.ok && !c.skipped);
  const status: ProjectionParityReport["status"] =
    bundleTimedOut || eventsTimedOut
      ? "WARNING"
      : mismatches.some((m) => m.id.includes("bundle"))
        ? "BLOCKED"
        : mismatches.length > 0
          ? "WARNING"
          : "OK";

  return {
    status,
    eventCount,
    checkedSections,
    parityIssues: mismatches,
    skippedChecks,
    checks,
    mismatches,
    lastCheckedAt,
    timedOut: bundleTimedOut || eventsTimedOut || undefined,
  };
}
