import { loadFailedAutomationJobs } from "@/lib/automation-control-plane/state-store";
import { getDailySelfReviewStatus } from "@/lib/daily-self-review/run-daily-self-review";
import { loadAnomalyIncidents } from "@/lib/anomaly-detection/store";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { loadTradeBlackBoxStore } from "@/lib/trade-black-box/black-box-store";
import { buildImprovementProposal } from "./build-proposal";
import { reviewIssueWithCommittee } from "./committee-review";
import { detectImprovementIssues } from "./detect-issues";
import {
  getImprovementProposal,
  markImprovementDetectRun,
  patchImprovementProposal,
  upsertImprovementProposal,
} from "./improvement-store";
import { verifyImprovementAfterDeploy } from "./verify-deploy";
import type {
  ContinuousImprovementStatus,
  ImprovementProposal,
} from "./types";
import { CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE } from "./types";
import { loadImprovementStore } from "./improvement-store";

function isDailyReviewMissing(lastRunAt: string | null): boolean {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  const now = new Date();
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

async function buildDetectionContext() {
  const [flow, dailyStatus, blackBoxStore, anomalies, failedJobs] = await Promise.all([
    buildMissionFlowServerSnapshot({ fresh: true }),
    getDailySelfReviewStatus().catch(() => null),
    loadTradeBlackBoxStore().catch(() => null),
    loadAnomalyIncidents().catch(() => []),
    loadFailedAutomationJobs().catch(() => []),
  ]);

  return {
    mission: flow.snapshot,
    dataTrustGrade: null as string | null,
    enginesNeedingAttention: flow.snapshot.enginesNeedingAttention,
    openAnomalies: anomalies.filter(
      (a) => a.status === "OPEN" || a.status === "INVESTIGATING",
    ),
    recentBlackBoxFailures: (blackBoxStore?.records ?? []).filter(
      (r) => r.failureCause.category !== "NONE",
    ),
    dailyReviewMissing: isDailyReviewMissing(dailyStatus?.lastRunAt ?? null),
    strategyBlockReason: flow.snapshot.strategyHealth?.blockReason ?? null,
    riskBlocker: flow.snapshot.risk.blocker,
    automationFailedJobs: failedJobs.slice(0, 5).map((j) => j.jobType),
  };
}

export async function runContinuousImprovementDetect(
  workspaceId = "server-default",
): Promise<{
  ok: boolean;
  detected: number;
  proposals: ImprovementProposal[];
  safetyNotice: typeof CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE;
}> {
  const ctx = await buildDetectionContext();
  const issues = detectImprovementIssues(ctx);
  const proposals: ImprovementProposal[] = [];

  for (const issue of issues) {
    const committee = reviewIssueWithCommittee(issue);
    if (committee.recommendation === "REJECT") continue;
    const proposal = buildImprovementProposal({ issue, committee, workspaceId });
    await upsertImprovementProposal(proposal, workspaceId);
    proposals.push(proposal);
  }

  await markImprovementDetectRun(workspaceId);

  return {
    ok: true,
    detected: issues.length,
    proposals,
    safetyNotice: CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE,
  };
}

export async function approveImprovementProposal(
  proposalId: string,
  approvedBy = "operator",
  workspaceId = "server-default",
): Promise<ImprovementProposal | null> {
  const proposal = await getImprovementProposal(proposalId, workspaceId);
  if (!proposal || !["PROPOSED", "COMMITTEE_REVIEWED"].includes(proposal.status)) {
    return null;
  }
  return patchImprovementProposal(
    proposalId,
    {
      status: "APPROVED",
      approvedAt: new Date().toISOString(),
      approvedBy,
    },
    workspaceId,
  );
}

export async function rejectImprovementProposal(
  proposalId: string,
  workspaceId = "server-default",
): Promise<ImprovementProposal | null> {
  return patchImprovementProposal(proposalId, { status: "REJECTED" }, workspaceId);
}

export async function markImprovementImplemented(
  proposalId: string,
  workspaceId = "server-default",
): Promise<ImprovementProposal | null> {
  const proposal = await getImprovementProposal(proposalId, workspaceId);
  if (!proposal || proposal.status !== "APPROVED") return null;
  return patchImprovementProposal(
    proposalId,
    {
      status: "IMPLEMENTED",
      implementedAt: new Date().toISOString(),
    },
    workspaceId,
  );
}

export async function verifyImprovementProposal(
  proposalId: string,
  workspaceId = "server-default",
): Promise<ImprovementProposal | null> {
  const proposal = await getImprovementProposal(proposalId, workspaceId);
  if (!proposal || proposal.status !== "IMPLEMENTED") return null;

  await patchImprovementProposal(proposalId, { status: "VERIFYING" }, workspaceId);
  const result = await verifyImprovementAfterDeploy(proposal);

  return patchImprovementProposal(
    proposalId,
    {
      status: result.passed ? "VERIFIED" : "VERIFY_FAILED",
      verifiedAt: new Date().toISOString(),
      verificationPassed: result.passed,
      verificationSummary: `${result.summary} ${result.checks.join(" ")}`,
    },
    workspaceId,
  );
}

export async function getContinuousImprovementStatus(
  workspaceId = "server-default",
): Promise<ContinuousImprovementStatus> {
  const store = await loadImprovementStore(workspaceId);
  const pendingApproval = store.proposals.filter((p) => p.status === "PROPOSED").length;
  const awaitingVerification = store.proposals.filter((p) =>
    ["APPROVED", "IMPLEMENTED", "VERIFYING"].includes(p.status),
  ).length;
  const verified = store.proposals.filter((p) => p.status === "VERIFIED").length;

  return {
    workspaceId,
    proposalCount: store.proposals.length,
    pendingApproval,
    awaitingVerification,
    verified,
    recent: store.proposals.slice(0, 12),
    lastDetectAt: store.lastDetectAt,
    safetyNotice: CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE,
  };
}
