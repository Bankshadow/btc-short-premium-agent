import { probeBinanceStatus } from "@/lib/testnet-engine-activation/activation-probes";
import { resolveBinanceTestnetDiagnosticFromStatus } from "@/lib/testnet-engine-activation/build-binance-testnet-diagnostic";
import { runCentralAnalysisOrchestrator } from "@/lib/analysis-engine/analysis-orchestrator";
import type { DeskRun } from "@/lib/data-backbone/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { BinanceOrderPreview } from "@/lib/exchange/binance/binance-types";

export interface GoalStartAiCycleResult {
  ok: boolean;
  analysis: AnalyzeApiResponse;
  journalEntry: DecisionLogEntry;
  journalStatus: "created" | "updated";
  autopilot: AutopilotRunResult;
  deskRun: DeskRun;
  testnetPreview: BinanceOrderPreview | null;
  testnetConnected: boolean;
  runId: string;
  error?: string;
}

/** Start AI — delegates to MVP 83 Central Analysis Engine. */
export async function runGoalStartAiCycle(): Promise<GoalStartAiCycleResult> {
  const diagnostic = resolveBinanceTestnetDiagnosticFromStatus(
    await probeBinanceStatus(),
  );
  const output = await runCentralAnalysisOrchestrator({
    trigger: "start_ai",
    enrichMvp9: true,
    runAutopilot: true,
    createTestnetPreview: diagnostic.connected,
  });

  if (!output.result.analyzeResponse || !output.result.journalEntry) {
    throw new Error("Central analysis did not return analyze response");
  }

  if (!output.deskRun) {
    throw new Error("DeskRun record was not created");
  }

  const autopilot = output.result.autopilot;
  if (!autopilot) {
    throw new Error("Autopilot result missing from central analysis");
  }

  const journalEntry = output.result.journalEntry;

  return {
    ok: output.ok,
    analysis: output.result.analyzeResponse,
    journalEntry,
    journalStatus: output.journalStatus,
    autopilot,
    deskRun: output.deskRun,
    testnetPreview: output.result.testnetPreview ?? null,
    testnetConnected: Boolean(output.result.context?.testnetStatus.connected),
    runId: output.runId,
  };
}
