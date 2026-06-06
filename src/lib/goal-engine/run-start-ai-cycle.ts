import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { enrichAnalyzeWithMvp9 } from "@/lib/desk/enrich-analyze-mvp9";
import { runAutopilotCycle } from "@/lib/autopilot/run-autopilot";
import { DEFAULT_AUTOPILOT_SETTINGS } from "@/lib/autopilot/config";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import {
  appendServerAnalysisFromResponse,
  loadServerAnalysisJournal,
} from "@/lib/journal/journal-server-store";
import {
  buildServerBackboneFromInput,
  writeServerBackboneRecord,
} from "@/lib/background-worker/server-backbone";
import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import { buildOrderPreview } from "@/lib/exchange/binance";
import { buildBinancePreviewInputFromAiSignal } from "@/lib/exchange/binance/build-ai-preview";
import type { DeskRun } from "@/lib/data-backbone/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { BinanceOrderPreview } from "@/lib/exchange/binance/binance-types";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";

export interface GoalStartAiCycleResult {
  ok: boolean;
  analysis: AnalyzeApiResponse;
  journalEntry: DecisionLogEntry;
  journalStatus: "created" | "updated";
  autopilot: AutopilotRunResult;
  deskRun: DeskRun;
  testnetPreview: BinanceOrderPreview | null;
  testnetConnected: boolean;
  error?: string;
}

export async function runGoalStartAiCycle(): Promise<GoalStartAiCycleResult> {
  const entries = await loadServerAnalysisJournal();
  const cronInput = await loadCronAnalysisInput();
  const analysis = await enrichAnalyzeWithMvp9(await runAnalyzeRequest(cronInput));
  const saved = await appendServerAnalysisFromResponse(analysis);

  const autopilot = await runAutopilotCycle({
    entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
    orders: [],
    perpPositions: [],
    riskProfile: "balanced",
    latestAnalysis: analysis,
    settings: {
      ...DEFAULT_AUTOPILOT_SETTINGS,
      autopilotEnabled: true,
      liveAutopilotEnabled: false,
      requireHumanApprovalForLive: true,
    },
    serverContext: await buildCommandCenterServerContext(),
  });

  const record = buildServerBackboneFromInput({
    entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
    orders: [],
    perpPositions: [],
    riskProfile: "balanced",
    autopilotResult: autopilot,
  });
  await writeServerBackboneRecord(record);

  const deskRun = record.run;
  if (!deskRun) {
    throw new Error("DeskRun record was not created");
  }

  const binanceStatus = await getBinanceStatus();
  const testnetConnected = Boolean(binanceStatus.connected);
  let testnetPreview: BinanceOrderPreview | null = null;

  const verdict =
    analysis.tradingDesk?.weightedCommittee?.weightedVerdict ??
    analysis.step5_verdict?.recommendation;

  if (testnetConnected && verdict === "TRADE") {
    try {
      const previewInput = buildBinancePreviewInputFromAiSignal({
        data: analysis,
        decisionLogId: saved.entry.id,
      });
      testnetPreview = await buildOrderPreview(previewInput);
    } catch {
      testnetPreview = null;
    }
  }

  const verdictLabel =
    analysis.tradingDesk?.weightedCommittee?.weightedVerdict ??
    analysis.step5_verdict?.recommendation ??
    saved.entry.finalVerdict ??
    "—";

  void emitMissionAlert({
    kind: "cycle_complete",
    title: "AI cycle complete",
    body: `Verdict: ${String(verdictLabel).toUpperCase()} · desk run ${deskRun.runId.slice(0, 12)}…`,
  }).catch(() => undefined);

  if (String(verdictLabel).toUpperCase() === "TRADE") {
    void emitMissionAlert({
      kind: "trade_verdict",
      title: "TRADE verdict — review required",
      body: testnetPreview
        ? `${testnetPreview.symbol} ${testnetPreview.side} preview ready · double confirm on Dashboard.`
        : "No testnet preview created — check Binance connection.",
    }).catch(() => undefined);
  }

  return {
    ok: true,
    analysis,
    journalEntry: saved.entry,
    journalStatus: saved.status,
    autopilot,
    deskRun,
    testnetPreview,
    testnetConnected,
  };
}
