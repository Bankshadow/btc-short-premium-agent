import { runCentralAnalysisOrchestrator } from "@/lib/analysis-engine/analysis-orchestrator";
import { emitEngineEvent } from "@/lib/engine-event-bus/emit-engine-event";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { resolveBinanceTestnetDiagnosticFromStatus } from "./build-binance-testnet-diagnostic";
import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import type { AutomationJobContext } from "@/lib/automation-control-plane/run-job";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";

export interface EngineActivationDeskAnalyzeResult {
  summary: string;
  analysis: AnalyzeApiResponse;
  decisionLogId: string;
  autopilot: AutopilotRunResult;
  testnetConnected: boolean;
}

/**
 * MVP 95 — central engine path for desk analyze with guaranteed engine events.
 * Used when testnet-primary automation is active.
 */
export async function runEngineActivationDeskAnalyze(
  ctx: AutomationJobContext,
): Promise<EngineActivationDeskAnalyzeResult> {
  const binanceStatus = await getBinanceStatus().catch(() => null);
  const diagnostic = resolveBinanceTestnetDiagnosticFromStatus(binanceStatus);

  await emitEngineEvent({
    type: "ANALYSIS_STARTED",
    runId: ctx.runId,
    summary: `Automation cycle started (${ctx.runId.slice(0, 16)}…)`,
    meaningful: false,
  });

  const output = await runCentralAnalysisOrchestrator({
    trigger: "automation",
    runId: ctx.runId,
    enrichMvp9: true,
    runAutopilot: true,
    createTestnetPreview: diagnostic.connected,
  });

  if (!output.result.analyzeResponse || !output.result.journalEntry) {
    await emitEngineEvent({
      type: "BLOCKER_CREATED",
      runId: ctx.runId,
      summary: output.error ?? "Central analysis did not produce a journal entry.",
      meaningful: true,
      severity: "critical",
    });
    throw new Error(output.error ?? "Central analysis failed");
  }

  if (!diagnostic.connected) {
    await emitEngineEvent({
      type: "BLOCKER_CREATED",
      runId: ctx.runId,
      decisionLogId: output.result.decisionLogId,
      summary: `Testnet ${diagnostic.status}: ${diagnostic.reason}`,
      detail: diagnostic.recommendation,
      meaningful: true,
      severity: "warning",
    });
  }

  await buildMissionFlowServerSnapshot({ fresh: true }).catch(() => null);

  const verdict = output.result.finalVerdict;
  const summary = diagnostic.connected
    ? `Central analyze ${verdict} · decision ${output.result.decisionLogId.slice(0, 12)}…`
    : `Central analyze ${verdict} · testnet ${diagnostic.status} — no preview/execute`;

  return {
    summary,
    analysis: output.result.analyzeResponse,
    decisionLogId: output.result.decisionLogId,
    autopilot: output.result.autopilot!,
    testnetConnected: diagnostic.connected,
  };
}
