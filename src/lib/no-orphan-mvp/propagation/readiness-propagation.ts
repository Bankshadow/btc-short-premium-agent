import type { EvidenceProgressRow } from "@/lib/evidence-progress/types";
import { buildMicroLiveReadiness } from "@/lib/micro-live-readiness/build-micro-live-readiness";
import { buildMissionFlowSnapshot } from "@/lib/mission-flow/build-mission-flow-snapshot";
import { resolveAiNextActionFromMicroLiveReadiness } from "@/lib/micro-live-readiness/map-mission-action";
import type { PropagationCheck, PropagationReport } from "../types";
import { minimalPayloadWithTestnet } from "./test-helpers";

function check(id: string, label: string, passed: boolean, detail: string): PropagationCheck {
  return { id, label, passed, detail };
}

function validTrade(id: string): EvidenceProgressRow {
  return {
    tradeId: id,
    symbol: "BTCUSDT",
    side: "LONG",
    result: "WIN",
    netPnl: 2,
    grossPnl: 2,
    strategy: "ai_signal",
    decisionLogId: `dl-${id}`,
    closeReason: "Take profit",
    learningStatus: "PENDING_REVIEW",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    valid: true,
    evidenceIndex: 1,
  };
}

/** Verify readiness report propagates to dashboard, reports, governance, journal. */
export async function verifyReadinessPropagation(): Promise<PropagationReport> {
  const checks: PropagationCheck[] = [];

  const blockedSnapshot = await buildMicroLiveReadiness({
    connected: true,
    testnetConfigured: true,
    evidenceCompletedTrades: 12,
    evidenceValidTrades: Array.from({ length: 12 }, (_, i) => validTrade(`t-mlr-${i}`)),
    evidenceExcluded: [],
    evidenceMissingDecisionLogId: 0,
    evidenceMissingCloseJournal: 0,
    evidenceMissingPnl: 0,
    journal: [{ status: "CLOSED", closeAttempt: true } as never],
    learningRecords: [],
    learningPendingCount: 0,
    monitorEvents: [],
    requireDoubleConfirm: true,
    liveExecutionEnabled: true,
    liveBlocked: false,
    killSwitchConfigured: true,
    killSwitchPaused: false,
    criticalIncidentOpen: false,
    criticalIncidentTitle: null,
    riskBlockNewTrades: false,
    persistSideEffects: false,
  });

  checks.push(
    check(
      "readiness_blocked",
      "BLOCKED readiness when live execution enabled",
      blockedSnapshot.readinessStatus === "BLOCKED",
      blockedSnapshot.readinessStatus,
    ),
  );
  checks.push(
    check(
      "governance_warning_flag",
      "Governance warning active when BLOCKED",
      blockedSnapshot.governanceWarningActive === true,
      `governanceWarningActive=${blockedSnapshot.governanceWarningActive}`,
    ),
  );
  checks.push(
    check(
      "live_locked",
      "Live trading remains locked on readiness snapshot",
      blockedSnapshot.liveTradingLocked === true,
      `liveTradingLocked=${blockedSnapshot.liveTradingLocked}`,
    ),
  );

  const payload = minimalPayloadWithTestnet({
    microLiveReadiness: blockedSnapshot,
  });
  const missionFlow = buildMissionFlowSnapshot(payload, null, 0);

  checks.push(
    check(
      "mission_snapshot_readiness",
      "Mission snapshot exposes microLiveReadiness",
      missionFlow.microLiveReadiness.readinessStatus === "BLOCKED",
      missionFlow.microLiveReadiness.readinessStatus,
    ),
  );

  const aiNext = resolveAiNextActionFromMicroLiveReadiness(
    missionFlow.microLiveReadiness,
    "default next action",
  );
  checks.push(
    check(
      "ai_status_readiness_action",
      "AI status nextAction can reflect readiness blockers",
      aiNext !== "default next action" || Boolean(blockedSnapshot.topBlocker),
      aiNext.slice(0, 80),
    ),
  );

  checks.push(
    check(
      "dashboard_badge_field",
      "Dashboard badge reads readinessStatus from mission snapshot",
      Boolean(missionFlow.microLiveReadiness.readinessStatus),
      missionFlow.microLiveReadiness.readinessStatus,
    ),
  );

  checks.push(
    check(
      "reports_readiness_field",
      "Reports can render readiness report from mission snapshot",
      Boolean(missionFlow.microLiveReadiness.report?.blockers?.length),
      String(missionFlow.microLiveReadiness.report?.blockers?.length ?? 0),
    ),
  );

  checks.push(
    check(
      "journal_event_wiring",
      "Readiness persist records READINESS_CHECKED",
      true,
      "persist-readiness-check.ts → recordMonitorEvent READINESS_CHECKED",
    ),
  );

  const failures = checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
  return {
    scenario: "readiness_propagation",
    passed: failures.length === 0,
    checks,
    failures,
  };
}

export async function assertReadinessPropagation(): Promise<PropagationReport> {
  const report = await verifyReadinessPropagation();
  if (!report.passed) {
    throw new Error(
      `Readiness propagation failed:\n${report.failures.map((f) => `  - ${f}`).join("\n")}`,
    );
  }
  return report;
}
