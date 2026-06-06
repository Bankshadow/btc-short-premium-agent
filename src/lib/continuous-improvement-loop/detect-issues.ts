import type { AnomalyIncident } from "@/lib/anomaly-detection/types";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import type { TradeBlackBoxRecord } from "@/lib/trade-black-box/types";
import type { DetectedImprovementIssue, ImprovementIssueType } from "./types";

export interface IssueDetectionContext {
  mission: MissionFlowSnapshot;
  dataTrustGrade?: string | null;
  enginesNeedingAttention?: number;
  openAnomalies?: AnomalyIncident[];
  recentBlackBoxFailures?: TradeBlackBoxRecord[];
  dailyReviewMissing?: boolean;
  strategyBlockReason?: string | null;
  riskBlocker?: string | null;
  automationFailedJobs?: string[];
}

function issue(
  partial: Omit<DetectedImprovementIssue, "issueId" | "detectedAt">,
): DetectedImprovementIssue {
  return {
    issueId: `issue-${partial.fingerprint}`,
    detectedAt: new Date().toISOString(),
    ...partial,
  };
}

function mapAnomalyType(type: string): ImprovementIssueType | null {
  if (type.includes("stale") || type.includes("ledger") || type.includes("mismatch")) {
    return "DATA_NOT_FLOWING";
  }
  if (
    type.includes("testnet") ||
    type.includes("close") ||
    type.includes("execution") ||
    type.includes("exchange")
  ) {
    return "TESTNET_FAILURE";
  }
  if (type.includes("alert")) return "UX_ISSUE";
  return "RISK_GAP";
}

export function detectImprovementIssues(
  ctx: IssueDetectionContext,
): DetectedImprovementIssue[] {
  const out: DetectedImprovementIssue[] = [];
  const m = ctx.mission;

  if (m.binanceTestnet.status !== "CONNECTED") {
    out.push(
      issue({
        issueType: "TESTNET_FAILURE",
        fingerprint: `testnet-${m.binanceTestnet.status}`,
        title: "Binance testnet not connected",
        summary: m.binanceTestnet.reason,
        evidence: [m.binanceTestnet.reason],
        severity: m.binanceTestnet.status === "BLOCKED" ? "HIGH" : "MEDIUM",
        sourceModule: "mission-flow",
      }),
    );
  }

  if ((ctx.enginesNeedingAttention ?? m.enginesNeedingAttention) > 0) {
    out.push(
      issue({
        issueType: "DATA_NOT_FLOWING",
        fingerprint: `engines-attention-${ctx.enginesNeedingAttention ?? m.enginesNeedingAttention}`,
        title: "Desk engines need attention",
        summary: `${ctx.enginesNeedingAttention ?? m.enginesNeedingAttention} engine(s) degraded or stale.`,
        evidence: [`enginesNeedingAttention=${ctx.enginesNeedingAttention ?? m.enginesNeedingAttention}`],
        severity: "MEDIUM",
        sourceModule: "goal-engine",
      }),
    );
  }

  if (ctx.dataTrustGrade === "D" || ctx.dataTrustGrade === "CRITICAL") {
    out.push(
      issue({
        issueType: "DATA_NOT_FLOWING",
        fingerprint: `data-trust-${ctx.dataTrustGrade}`,
        title: "Low data trust grade",
        summary: `Analyze data trust grade is ${ctx.dataTrustGrade} — market inputs may be incomplete.`,
        evidence: [`dataTrustGrade=${ctx.dataTrustGrade}`],
        severity: "HIGH",
        sourceModule: "analyze",
      }),
    );
  }

  for (const record of ctx.recentBlackBoxFailures ?? []) {
    if (record.failureCause.category === "NONE") continue;
    out.push(
      issue({
        issueType: "TESTNET_FAILURE",
        fingerprint: `blackbox-${record.tradeId}-${record.failureCause.category}`,
        title: `Trade failure: ${record.failureCause.headline}`,
        summary: record.failureCause.detail,
        evidence: record.failureCause.evidence.slice(0, 5),
        severity: record.failureCause.severity === "HIGH" ? "HIGH" : "MEDIUM",
        sourceModule: "trade-black-box",
      }),
    );
  }

  if (ctx.strategyBlockReason || (m.strategyHealth && !m.strategyHealth.tradeAllowed)) {
    const reason =
      ctx.strategyBlockReason ??
      m.strategyHealth?.blockReason ??
      "Strategy health blocked trading.";
    out.push(
      issue({
        issueType: "STRATEGY_WEAKNESS",
        fingerprint: `strategy-${m.strategyHealth?.strategyId ?? "primary"}`,
        title: "Strategy health blocking trades",
        summary: reason,
        evidence: [reason],
        severity: "MEDIUM",
        sourceModule: "strategy-health",
      }),
    );
  }

  if (ctx.dailyReviewMissing && m.closedTrades > 0) {
    out.push(
      issue({
        issueType: "REPORT_MISSING",
        fingerprint: `daily-review-${new Date().toISOString().slice(0, 10)}`,
        title: "Daily AI self-review not generated today",
        summary: "End-of-day report missing — lessons and tomorrow plan unavailable.",
        evidence: ["No daily self-review record for UTC day."],
        severity: "LOW",
        sourceModule: "daily-self-review",
      }),
    );
  }

  const riskBlocker = ctx.riskBlocker ?? m.risk.blocker;
  if (riskBlocker) {
    out.push(
      issue({
        issueType: "RISK_GAP",
        fingerprint: `risk-${riskBlocker.slice(0, 48)}`,
        title: "Mission risk blocker",
        summary: riskBlocker,
        evidence: [riskBlocker],
        severity: "HIGH",
        sourceModule: "mission-risk",
      }),
    );
  }

  if (m.pendingLearningReview > 2 && !m.automation.autoLearnEnabled) {
    out.push(
      issue({
        issueType: "UX_ISSUE",
        fingerprint: `learning-queue-${m.pendingLearningReview}`,
        title: "Learning review queue backing up",
        summary: `${m.pendingLearningReview} trades await operator review — UX friction on /reports.`,
        evidence: [`pendingLearningReview=${m.pendingLearningReview}`],
        severity: "LOW",
        sourceModule: "testnet-monitor",
      }),
    );
  }

  for (const incident of ctx.openAnomalies ?? []) {
    if (incident.status === "RESOLVED" || incident.status === "SUPPRESSED") continue;
    const mapped = mapAnomalyType(incident.anomalyType);
    if (!mapped) continue;
    out.push(
      issue({
        issueType: mapped,
        fingerprint: `anomaly-${incident.fingerprint}`,
        title: incident.title,
        summary: incident.recommendedAction,
        evidence: [incident.title, incident.recommendedAction],
        severity: incident.severity === "CRITICAL" ? "HIGH" : "MEDIUM",
        sourceModule: "anomaly-detection",
      }),
    );
  }

  for (const job of ctx.automationFailedJobs ?? []) {
    out.push(
      issue({
        issueType: "DATA_NOT_FLOWING",
        fingerprint: `automation-fail-${job}`,
        title: `Automation job failed: ${job}`,
        summary: `Recent automation failure on ${job} may block data or learning flows.`,
        evidence: [job],
        severity: "MEDIUM",
        sourceModule: "automation-control-plane",
      }),
    );
  }

  const seen = new Set<string>();
  return out.filter((i) => {
    if (seen.has(i.fingerprint)) return false;
    seen.add(i.fingerprint);
    return true;
  });
}
