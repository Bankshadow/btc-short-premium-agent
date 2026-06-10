import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";
import type { AnalysisResult } from "@/lib/analysis-engine/analysis-result";
import { emitEngineEvents } from "./emit-engine-event";
import type { EngineEvent } from "./types";

export async function emitAnalysisPipelineEngineEvents(input: {
  runId: string;
  context: AnalysisContext;
  analysis: AnalyzeApiResponse;
  result: AnalysisResult;
  previewCreated: boolean;
}): Promise<EngineEvent[]> {
  const { runId, context, analysis, result, previewCreated } = input;
  const decisionLogId = result.decisionLogId;
  const symbol = result.tradeCandidate?.symbol ?? null;

  const events = await emitEngineEvents([
    {
      type: "CONTEXT_BUILT",
      runId,
      decisionLogId,
      summary: `Context built · ${context.environment} · ${context.positions.length} open position(s)`,
      meaningful: false,
      payload: {
        openPositions: context.positions.length,
        killSwitchActive: context.killSwitch.active,
      },
    },
    {
      type: "PLAYBOOK_COMPLETED",
      runId,
      decisionLogId,
      summary: `Playbook complete · spot ${context.market.spotPrice ?? "—"}`,
      meaningful: false,
    },
    {
      type: "AGENTS_REVIEWED",
      runId,
      decisionLogId,
      summary: `Committee reviewed · ${context.councilState.agentCount} agent(s)`,
      meaningful: false,
      payload: {
        weightedVerdict: context.councilState.weightedVerdict,
        confidence: context.councilState.confidence,
      },
    },
    {
      type: "GOVERNANCE_CHECKED",
      runId,
      decisionLogId,
      summary: context.governance?.safeMode
        ? "Governance safe mode active"
        : "Governance checks passed",
      meaningful: false,
      payload: {
        safeMode: Boolean(context.governance?.safeMode),
        pauseAnalysis: Boolean(context.governance?.pauseAnalysis),
      },
    },
    {
      type: "RISK_CHECKED",
      runId,
      decisionLogId,
      summary: `Risk ${result.riskStatus} · ${result.blockers.length} blocker(s)`,
      meaningful: false,
      payload: { riskStatus: result.riskStatus },
    },
    {
      type: "EXECUTION_READINESS_CHECKED",
      runId,
      decisionLogId,
      summary: context.testnetStatus.connected
        ? "Execution readiness checked — testnet connected, live locked"
        : "Execution readiness blocked — Binance testnet not connected",
      meaningful: false,
      payload: {
        testnetConnected: context.testnetStatus.connected,
        liveTradingLocked: true,
      },
    },
    {
      type: "VERDICT_CREATED",
      runId,
      decisionLogId,
      summary: `Verdict ${result.finalVerdict} · ${result.confidence}% confidence`,
      meaningful: true,
      payload: {
        finalVerdict: result.finalVerdict,
        confidence: result.confidence,
      },
    },
  ]);

  if (result.finalVerdict === "TRADE" && result.tradeCandidate) {
    events.push(
      ...(await emitEngineEvents([
        {
          type: "TRADE_CANDIDATE_CREATED",
          runId,
          decisionLogId,
          symbol,
          summary: `Trade candidate ${symbol ?? "—"} · double confirm required`,
          meaningful: true,
        },
      ])),
    );
  }

  if (previewCreated && result.tradeCandidate?.previewId) {
    events.push(
      ...(await emitEngineEvents([
        {
          type: "PREVIEW_CREATED",
          runId,
          decisionLogId,
          previewId: result.tradeCandidate.previewId,
          symbol,
          summary: `Testnet preview ${symbol ?? ""} ready for review`,
          meaningful: true,
        },
      ])),
    );
  }

  if (result.blockers.length > 0) {
    events.push(
      ...(await emitEngineEvents([
        {
          type: "BLOCKER_CREATED",
          runId,
          decisionLogId,
          summary: result.blockers[0],
          detail: result.blockers.slice(0, 3).join("; "),
          severity: "critical",
          meaningful: true,
        },
      ])),
    );
  }

  events.push(
    ...(await emitEngineEvents([
      {
        type: "MISSION_SNAPSHOT_UPDATED",
        runId,
        decisionLogId,
        summary: "Mission snapshot refreshed after analysis cycle",
        meaningful: false,
      },
      {
        type: "AI_STATUS_UPDATED",
        runId,
        decisionLogId,
        summary: `AI state ${result.aiState} · next: ${result.nextAction.slice(0, 80)}`,
        meaningful: true,
        payload: {
          aiState: result.aiState,
          finalVerdict: result.finalVerdict,
        },
      },
      {
        type: "REPORT_UPDATED",
        runId,
        decisionLogId,
        summary: result.reportSummary,
        meaningful: true,
        payload: {
          playbookRecommendation: analysis.step5_verdict?.recommendation ?? null,
        },
      },
    ])),
  );

  return events;
}
