import { buildEnrichedTradeProjection } from "./build-enriched-trade-projection";
import { buildProjectionBundle } from "./projection-bundle";
import { readCoreEvents } from "./event-store";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress";
import { buildReportsSummary } from "@/lib/reports/build-reports-summary";
import { getTradesSummary } from "@/lib/trades/trade-query";

export interface ProjectionParityCheck {
  id: string;
  ok: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

export interface ProjectionParityReport {
  status: "OK" | "WARNING" | "BLOCKED";
  checks: ProjectionParityCheck[];
  mismatches: ProjectionParityCheck[];
  lastCheckedAt: string;
}

function check(
  id: string,
  ok: boolean,
  message: string,
  expected?: string,
  actual?: string,
): ProjectionParityCheck {
  return { id, ok, message, expected, actual };
}

export async function runProjectionParityCheck(): Promise<ProjectionParityReport> {
  const lastCheckedAt = new Date().toISOString();
  const checks: ProjectionParityCheck[] = [];

  const bundle = await buildProjectionBundle();
  const events = await readCoreEvents();
  const legacyMission = buildMissionSnapshot(events);
  const legacyTrades = await getTradesSummary();
  const enriched = await buildEnrichedTradeProjection(events);
  const legacyEvidence = buildEvidenceProgressFromEvents(events);
  const reports = await buildReportsSummary();

  if (!bundle.ok) {
    checks.push(check("bundle_ok", false, "Projection bundle failed", "ok", "error"));
    const mismatches = checks.filter((c) => !c.ok);
    return { status: "BLOCKED", checks, mismatches, lastCheckedAt };
  }

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
      bundle.trades.open.length === legacyTrades.summary.openCount,
      "Bundle open count matches legacy trades",
      String(bundle.trades.open.length),
      String(legacyTrades.summary.openCount),
    ),
  );

  checks.push(
    check(
      "trade_closed_count",
      bundle.trades.closed.length === legacyTrades.summary.closedCount,
      "Bundle closed count matches legacy trades",
      String(bundle.trades.closed.length),
      String(legacyTrades.summary.closedCount),
    ),
  );

  checks.push(
    check(
      "enriched_open_count",
      enriched.summary.openCount === legacyTrades.summary.openCount,
      "Enriched trades open count matches legacy",
      String(enriched.summary.openCount),
      String(legacyTrades.summary.openCount),
    ),
  );

  checks.push(
    check(
      "pnl_realized",
      Math.abs(bundle.pnl.totalNetPnl - legacyTrades.summary.realizedPnl) < 0.01,
      "Bundle PnL matches legacy trade summary realized PnL",
      String(bundle.pnl.totalNetPnl),
      String(legacyTrades.summary.realizedPnl),
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

  checks.push(
    check(
      "reports_mission_equity",
      reports.mission.currentEquity === bundle.mission.currentEquity,
      "Reports summary mission equity matches bundle",
      String(bundle.mission.currentEquity),
      String(reports.mission.currentEquity),
    ),
  );

  checks.push(
    check(
      "reports_open_trades",
      reports.mission.openPositions === bundle.positions.openTradeCount,
      "Reports open positions matches position projection",
      String(bundle.positions.openTradeCount),
      String(reports.mission.openPositions),
    ),
  );

  const mismatches = checks.filter((c) => !c.ok);
  const status: ProjectionParityReport["status"] =
    mismatches.some((m) => m.id.includes("bundle")) ? "BLOCKED" : mismatches.length > 0 ? "WARNING" : "OK";

  return { status, checks, mismatches, lastCheckedAt };
}
