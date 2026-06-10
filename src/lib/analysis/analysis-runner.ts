import { createTestnetPreview } from "@/lib/execution/create-preview";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newDecisionLogId, newRunId } from "@/lib/journal/journal-types";
import { getLatestActivePreview } from "@/lib/execution/preview-store";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import type { AnalysisResult, VerdictPayload } from "./analysis-types";
import { runScenarioAwareAnalysis } from "./scenario-aware-analysis";
import { getOperatorStatus } from "@/lib/operator/operator-actions";

export async function runAnalysis(): Promise<AnalysisResult> {
  const runId = newRunId();
  const decisionLogId = newDecisionLogId();
  const priorEvents = await getEvents();
  await getOperatorStatus();

  await appendEvent({
    type: "ANALYSIS_STARTED",
    environment: "testnet",
    runId,
    decisionLogId,
    payload: { trigger: "manual" },
  });

  const scenarioResult = await runScenarioAwareAnalysis({
    runId,
    decisionLogId,
    priorEvents,
  });

  let previewId: string | null = null;
  let preview = null;

  if (scenarioResult.finalVerdict === "TRADE") {
    const previewResult = await createTestnetPreview({ runId, decisionLogId });
    previewId = previewResult.preview?.previewId ?? null;
    preview = previewResult.preview;
  }

  const events = await getEvents();
  const missionSnapshot = buildMissionSnapshot(events);

  await appendEvent({
    type: "MISSION_SNAPSHOT_UPDATED",
    environment: "testnet",
    runId,
    decisionLogId,
    previewId: previewId ?? undefined,
    payload: {
      startCapital: missionSnapshot.startCapital,
      targetCapital: missionSnapshot.targetCapital,
      currentEquity: missionSnapshot.currentEquity,
      progressPct: missionSnapshot.progressPct,
      netPnl: missionSnapshot.netPnl,
      totalTrades: missionSnapshot.totalTrades,
      wins: missionSnapshot.win,
      losses: missionSnapshot.loss,
      previewId,
      strategyVersionId: scenarioResult.strategyVersionId,
    },
  });

  return {
    runId,
    decisionLogId,
    verdict: scenarioResult.verdict,
    previewId,
    preview,
    missionSnapshot,
    scenarioContext: scenarioResult.scenarioContext,
    swarmAgreement: scenarioResult.swarmAgreement,
    scenarioNote: scenarioResult.scenarioNote,
    regime: scenarioResult.regime.regime,
    noTradeRules: scenarioResult.noTradeRules,
    strategyVersionId: scenarioResult.strategyVersionId,
  };
}

export async function getLatestAnalysis(): Promise<{
  runId: string | null;
  decisionLogId: string | null;
  verdict: VerdictPayload | null;
  previewId: string | null;
  scenarioContext: VerdictPayload["scenarioContext"] | null;
  swarmAgreement: VerdictPayload["swarmAgreement"] | null;
  scenarioNote: string | null;
  regime: string | null;
  noTradeBlockReason: string | null;
  strategyVersionId: string | null;
}> {
  const events = await getEvents();
  const snapshot = buildMissionSnapshot(events);
  const activePreview = await getLatestActivePreview();
  const verdictEvt = [...events]
    .filter((e) => e.type === "VERDICT_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const payload = verdictEvt?.payload as unknown as VerdictPayload | undefined;

  return {
    runId: snapshot.latestRunId,
    decisionLogId: snapshot.latestDecisionLogId,
    verdict:
      snapshot.latestVerdict != null
        ? {
            verdict: snapshot.latestVerdict,
            confidence: snapshot.latestConfidence ?? 0,
            reasons: snapshot.latestVerdictReasons,
            scenarioContext: payload?.scenarioContext,
            swarmAgreement: payload?.swarmAgreement,
            scenarioNote: payload?.scenarioNote,
            regime: payload?.regime,
            strategyVersionId: payload?.strategyVersionId,
            noTradeBlockReason: payload?.noTradeBlockReason,
          }
        : null,
    previewId: activePreview?.previewId ?? null,
    scenarioContext: payload?.scenarioContext ?? null,
    swarmAgreement: payload?.swarmAgreement ?? null,
    scenarioNote: payload?.scenarioNote ?? null,
    regime: payload?.regime ?? null,
    noTradeBlockReason: payload?.noTradeBlockReason ?? null,
    strategyVersionId: payload?.strategyVersionId ?? null,
  };
}
