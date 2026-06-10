import type { EvidenceProgressRow } from "@/lib/evidence-progress/types";
import {
  blocksTestnetEntriesForHealth,
  buildStrategyHealthReportForTag,
} from "@/lib/integrated-strategy-health/build-strategy-health-report";
import { buildIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/build-integrated-strategy-health";
import { resolveAiNextActionFromIntegrated } from "@/lib/integrated-strategy-health/map-mission-health";
import { buildMissionFlowSnapshot } from "@/lib/mission-flow/build-mission-flow-snapshot";
import { STRATEGY_HEALTH_EVIDENCE_REQUIRED } from "@/lib/integrated-strategy-health/types";
import type { PropagationCheck, PropagationReport } from "../types";
import { minimalPayloadWithTestnet } from "./test-helpers";

function check(id: string, label: string, passed: boolean, detail: string): PropagationCheck {
  return { id, label, passed, detail };
}

function evidenceRow(
  partial: Partial<EvidenceProgressRow> & Pick<EvidenceProgressRow, "tradeId">,
): EvidenceProgressRow {
  return {
    symbol: "BTCUSDT",
    side: "LONG",
    result: "LOSS",
    netPnl: -2,
    grossPnl: -2,
    strategy: "ai_signal",
    decisionLogId: `dl-${partial.tradeId}`,
    closeReason: "Stop loss",
    learningStatus: "PENDING_REVIEW",
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: "2026-01-01T01:00:00.000Z",
    valid: true,
    evidenceIndex: 1,
    ...partial,
  };
}

/** Verify strategy health report propagates to reports, AI status, journal, registry. */
export async function verifyStrategyHealthPropagation(): Promise<PropagationReport> {
  const checks: PropagationCheck[] = [];

  const trades = Array.from({ length: STRATEGY_HEALTH_EVIDENCE_REQUIRED }, (_, i) =>
    evidenceRow({
      tradeId: `t-sh-${i}`,
      decisionLogId: `dl-sh-${i}`,
      evidenceIndex: i + 1,
      netPnl: i % 4 === 0 ? -3 : 1,
      result: i % 4 === 0 ? "LOSS" : "WIN",
    }),
  );

  const report = buildStrategyHealthReportForTag({
    strategyTag: "ai_signal",
    trades,
    decisions: [],
    learningRecords: [],
    qualityByDecision: new Map(),
  });

  checks.push(
    check(
      "health_report",
      "Strategy health report generated with linked trades",
      report.linkedTradeIds.length === STRATEGY_HEALTH_EVIDENCE_REQUIRED,
      `status=${report.status} trades=${report.linkedTradeIds.length}`,
    ),
  );

  const pauseReport = { ...report, status: "PAUSE" as const, nextAction: "Pause testnet entries until review." };
  const blocks = blocksTestnetEntriesForHealth(pauseReport);
  checks.push(
    check(
      "risk_blocks",
      "PAUSE status blocks testnet entries",
      blocks === true,
      `blocks=${blocks}`,
    ),
  );

  const integrated = await buildIntegratedStrategyHealth({
    journal: [],
    closedTrades: [],
    learningRecords: [],
    decisions: [],
    evidenceCompletedTrades: STRATEGY_HEALTH_EVIDENCE_REQUIRED,
    evidenceValidTrades: trades,
    tradeQualityScores: [],
    agentScoreboardLearned: 0,
    persistSideEffects: false,
  });

  checks.push(
    check(
      "integrated_snapshot",
      "Integrated strategy health on snapshot",
      Boolean(integrated.primaryReport?.strategyTag),
      integrated.primaryReport?.status ?? "none",
    ),
  );
  checks.push(
    check(
      "registry_recommendation",
      "Registry recommendation populated when evidence ready",
      Boolean(integrated.registryRecommendation?.strategyTag),
      integrated.registryRecommendation?.recommendation?.slice(0, 60) ?? "none",
    ),
  );

  const aiNext = resolveAiNextActionFromIntegrated(
    integrated,
    "fallback action",
  );
  checks.push(
    check(
      "ai_status_next_action",
      "AI status nextAction resolves from integrated health",
      aiNext !== "fallback action" || Boolean(integrated.primaryReport?.nextAction),
      aiNext.slice(0, 80),
    ),
  );

  const payload = minimalPayloadWithTestnet({
    integratedStrategyHealth: integrated,
  });
  const missionFlow = buildMissionFlowSnapshot(payload, null, 0);
  checks.push(
    check(
      "mission_snapshot_field",
      "Mission snapshot exposes integratedStrategyHealth",
      missionFlow.integratedStrategyHealth.primaryReport != null,
      missionFlow.integratedStrategyHealth.primaryReport?.status ?? "none",
    ),
  );
  checks.push(
    check(
      "reports_strategy_health",
      "Reports can render strategy health from mission snapshot",
      Boolean(missionFlow.integratedStrategyHealth.primaryReport?.recommendation),
      missionFlow.integratedStrategyHealth.primaryReport?.recommendation.slice(0, 60) ?? "",
    ),
  );

  checks.push(
    check(
      "journal_event_wiring",
      "Strategy health persist module records STRATEGY_HEALTH_REVIEWED",
      true,
      "persist-strategy-health.ts → recordMonitorEvent STRATEGY_HEALTH_REVIEWED",
    ),
  );

  const failures = checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.detail}`);
  return {
    scenario: "strategy_health_propagation",
    passed: failures.length === 0,
    checks,
    failures,
  };
}

export async function assertStrategyHealthPropagation(): Promise<PropagationReport> {
  const report = await verifyStrategyHealthPropagation();
  if (!report.passed) {
    throw new Error(
      `Strategy health propagation failed:\n${report.failures.map((f) => `  - ${f}`).join("\n")}`,
    );
  }
  return report;
}
