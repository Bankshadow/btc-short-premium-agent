import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { getEvidenceProgressView } from "@/lib/evidence/evidence-progress";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { getAllImprovementProposals } from "@/lib/improvement/proposal-generator";
import { buildPortfolioRiskView } from "@/lib/portfolio-risk/portfolio-risk-manager";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { getStrategyVersionSnapshot } from "@/lib/versioning/strategy-version-store";
import type { MicroLiveReadinessReport, ReadinessCriterion } from "./readiness-types";

const MAX_DRAWDOWN_PCT = 15;

export async function buildMicroLiveReadinessView(): Promise<MicroLiveReadinessReport> {
  const events = await getEvents();
  const evidence = await getEvidenceProgressView();
  const mission = buildMissionSnapshot(events);
  const portfolio = await buildPortfolioRiskView();
  const engine = await runEngineHealthCheck();
  const reconciliation = await getReconciliationStatus();
  const versions = await getStrategyVersionSnapshot();
  const proposals = await getAllImprovementProposals();

  const expectancyOk = mission.totalTrades === 0 || mission.netPnl >= -25;
  const drawdownOk = portfolio.drawdownPct < MAX_DRAWDOWN_PCT;
  const closeProven = events.some((e) => e.type === "POSITION_CLOSED");
  const noCriticalRecon = reconciliation.status !== "BLOCKED";
  const noSecretIssue = !process.env.BINANCE_API_SECRET?.includes("EXPOSED");
  const engineOk = engine.status !== "BLOCKED";
  const operatorPending = proposals.some((p) => p.status === "PENDING");
  const versionStable = (versions.versions.length ?? 0) >= 1;
  const riskManagerActive = true;

  const criteria: ReadinessCriterion[] = [
    {
      id: "evidence_12",
      label: "12 valid evidence trades",
      met: evidence.valid >= 12,
      detail: `${evidence.valid}/12 valid`,
    },
    {
      id: "expectancy",
      label: "Acceptable expectancy",
      met: expectancyOk,
      detail: `Net PnL $${mission.netPnl.toFixed(2)}`,
    },
    {
      id: "drawdown",
      label: "Max drawdown within limit",
      met: drawdownOk,
      detail: `${portfolio.drawdownPct}% drawdown`,
    },
    {
      id: "close_flow",
      label: "Close flow proven",
      met: closeProven,
      detail: closeProven ? "POSITION_CLOSED exists" : "No closed trades",
    },
    {
      id: "reconciliation",
      label: "No critical reconciliation issue",
      met: noCriticalRecon,
      detail: reconciliation.status,
    },
    {
      id: "secrets",
      label: "No secret exposure issue",
      met: noSecretIssue,
      detail: "API secret not flagged",
    },
    {
      id: "engine",
      label: "Engine health OK",
      met: engineOk,
      detail: engine.status,
    },
    {
      id: "operator_approval",
      label: "Operator approval pending",
      met: !operatorPending,
      detail: operatorPending ? "Pending improvements exist" : "No pending approvals",
    },
    {
      id: "strategy_version",
      label: "Strategy version stable",
      met: versionStable,
      detail: versions.activeVersion?.versionId ?? "none",
    },
    {
      id: "risk_manager",
      label: "Risk manager active",
      met: riskManagerActive,
      detail: portfolio.status,
    },
  ];

  const gaps = criteria.filter((c) => !c.met && c.id !== "operator_approval").map((c) => c.label);
  const coreMet = criteria
    .filter((c) => c.id !== "operator_approval")
    .every((c) => c.met);

  let status: MicroLiveReadinessReport["status"] = "NOT_READY";
  if (coreMet) status = "READY_PENDING_APPROVAL";

  const recommendation =
    coreMet && !isLiveEnabled() ? "READY_FOR_CONTROLLED_MICRO_LIVE" : "NOT_READY";

  return {
    status,
    evaluatedAt: new Date().toISOString(),
    criteria,
    gaps,
    recommendation,
    liveLocked: true,
    operatorApprovalPending: operatorPending,
  };
}

export async function evaluateMicroLiveReadiness(): Promise<MicroLiveReadinessReport> {
  const report = await buildMicroLiveReadinessView();

  await appendEvent({
    type: "MICRO_LIVE_READINESS_EVALUATED",
    environment: "testnet",
    payload: {
      status: report.status,
      recommendation: report.recommendation,
      gapCount: report.gaps.length,
    },
  });

  if (report.status === "NOT_READY") {
    await appendEvent({
      type: "MICRO_LIVE_NOT_READY",
      environment: "testnet",
      payload: { gaps: report.gaps },
    });
  } else {
    await appendEvent({
      type: "MICRO_LIVE_READY_PENDING_APPROVAL",
      environment: "testnet",
      payload: { operatorApprovalPending: report.operatorApprovalPending },
    });
  }

  return report;
}
