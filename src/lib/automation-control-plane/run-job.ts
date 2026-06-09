import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { runAutopilotCycle } from "@/lib/autopilot/run-autopilot";
import { DEFAULT_AUTOPILOT_SETTINGS } from "@/lib/autopilot/config";
import { buildLearningStatus } from "@/lib/autopilot/build-learning-status";
import { buildOperatorActionQueue } from "@/lib/operator-action-queue/build-action-queue";
import { applyTestnetPrimaryCommandCenterView } from "@/lib/command-center/apply-testnet-primary-view";
import { buildTestnetPerpDeskPanel } from "@/lib/command-center/build-testnet-perp-panel";
import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { appendServerAnalysisFromResponse } from "@/lib/journal/journal-server-store";
import { dispatchExternalBriefing, sanitizeBriefingText } from "@/lib/smart-briefing/dispatch";
import { computeUnrealizedPnlPct } from "@/lib/paper/paper-pnl-engine";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { getBtcTicker } from "@/lib/bybit/tickers";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { DeskBackboneHealth } from "@/lib/data-backbone/types";
import {
  buildServerBackboneFromInput,
  evaluateServerBackboneHealth,
  writeServerBackboneRecord,
} from "@/lib/background-worker/server-backbone";
import { mergeServerPendingOperatorActions } from "./state-store";
import { assertAutomationJobSafety } from "./safety";
import { buildPolicyInput, evaluatePolicy } from "@/lib/policy-engine";
import { getProjectStrategistStatus, runProjectStrategist } from "@/lib/project-strategist";
import { runBinanceTestnetAutoExecute } from "@/lib/exchange/binance/binance-auto-executor";
import { runBinanceTestnetAutoMonitor } from "@/lib/exchange/binance/binance-auto-monitor";
import { isBinanceTestnetAutoExecuteEnabled } from "@/lib/exchange/binance/binance-config";
import type { AutomationJob, AutomationJobType, AutomationRunInput } from "./types";
import type { AutomationServerContext } from "./server-context";
import { emitAnalyzePipelineEvents } from "@/lib/ai-status/emit-pipeline";
import { emitAiStatusEvent } from "@/lib/ai-status/event-store";
import {
  buildActionKey,
  buildApiErrorKey,
  buildMarketContextHash,
} from "@/lib/autopilot-loop-guard/fingerprints";
import { recordLoopGuardAction } from "@/lib/autopilot-loop-guard/record-action";
import {
  getOperationalBackboneBlockers,
  shouldBlockDeskAnalyzeOnBackbone,
} from "./analyze-backbone-gate";
import { isTestnetPrimaryAutomation } from "./primary-mode";

export type AutomationJobContext = {
  runId: string;
  workspaceId: string;
  input: AutomationRunInput;
  server: AutomationServerContext;
  analyze: AnalyzeApiResponse | null;
  autopilotResult: AutopilotRunResult | null;
  backboneHealth: DeskBackboneHealth | null;
  commandCenterStatus: string | null;
};

function jobId(jobType: AutomationJobType, runId: string): string {
  return `aj-${jobType}-${runId}`;
}

function idempotencyKey(
  workspaceId: string,
  jobType: AutomationJobType,
  runId: string,
): string {
  return `${workspaceId}:${jobType}:${runId}`;
}

function toAutomationJob(
  partial: Omit<AutomationJob, "jobId" | "workspaceId" | "linkedRunId"> & {
    jobType: AutomationJobType;
    runId: string;
    workspaceId: string;
  },
): AutomationJob {
  return {
    jobId: jobId(partial.jobType, partial.runId),
    workspaceId: partial.workspaceId,
    jobType: partial.jobType,
    status: partial.status,
    idempotencyKey: partial.idempotencyKey,
    startedAt: partial.startedAt,
    completedAt: partial.completedAt,
    durationMs: partial.durationMs,
    resultSummary: partial.resultSummary,
    error: partial.error,
    linkedRunId: partial.runId,
  };
}

async function runTimed(
  jobType: AutomationJobType,
  ctx: AutomationJobContext,
  fn: () => Promise<{ summary: string }>,
): Promise<AutomationJob> {
  assertAutomationJobSafety(jobType);
  const startedAt = new Date().toISOString();
  const start = Date.now();
  try {
    const { summary } = await fn();
    return toAutomationJob({
      jobType,
      runId: ctx.runId,
      workspaceId: ctx.workspaceId,
      status: "SUCCESS",
      idempotencyKey: idempotencyKey(ctx.workspaceId, jobType, ctx.runId),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      resultSummary: summary,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    return toAutomationJob({
      jobType,
      runId: ctx.runId,
      workspaceId: ctx.workspaceId,
      status: "FAILED",
      idempotencyKey: idempotencyKey(ctx.workspaceId, jobType, ctx.runId),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      resultSummary: message,
      error: message,
    });
  }
}

export async function runAutomationJob(
  jobType: AutomationJobType,
  ctx: AutomationJobContext,
): Promise<AutomationJob> {
  const { server } = ctx;
  const { entries, orders, riskProfile } = server;

  switch (jobType) {
    case "MARKET_SNAPSHOT":
      return runTimed(jobType, ctx, async () => {
        let btc = 0;
        try {
          const ticker = await getBtcTicker();
          btc = ticker.price;
        } catch {
          btc = ctx.analyze?.step1_marketSnapshot?.spotPrice ?? 0;
        }
        const trust = ctx.analyze?.dataTrust?.grade ?? "—";
        return { summary: `BTC ${btc || "n/a"} · data trust ${trust}` };
      });

    case "PARALLEL_AGENT_REVIEW":
      return runTimed(jobType, ctx, async () => {
        const { runParallelAgentReview } = await import(
          "@/lib/parallel-task-runner/run-parallel-review"
        );
        const result = await runParallelAgentReview({
          workspaceId: ctx.workspaceId,
          entries,
          orders,
          riskProfile,
        });
        await emitAiStatusEvent({
          type: "AGENTS_REVIEWED",
          runId: ctx.runId,
          detail: result.committee.summary,
          technical: `parallel-committee:${result.committee.recommendation}`,
        });
        return {
          summary: `${result.committee.recommendation} · ${result.reviews.length} agents · ${result.durationMs}ms`,
        };
      });

    case "DESK_ANALYZE":
      return runTimed(jobType, ctx, async () => {
        const eval_ = await evaluateServerBackboneHealth();
        ctx.backboneHealth = eval_.health;
        if (
          shouldBlockDeskAnalyzeOnBackbone({
            healthy: eval_.healthy,
            health: eval_.health,
            force: ctx.input.force,
          })
        ) {
          const operational = getOperationalBackboneBlockers(eval_.health!);
          throw new Error(
            operational[0] ??
              eval_.health!.staleWarning ??
              "Backbone unhealthy — analyze blocked.",
          );
        }

        const analyzePolicy = evaluatePolicy(
          buildPolicyInput({
            workspaceId: ctx.workspaceId,
            userRole: "ADMIN",
            environmentMode: "PAPER",
            action: "RUN_ANALYSIS",
            entries,
            orders,
            riskProfile,
            backboneHealthy: eval_.healthy,
          }),
        );
        if (analyzePolicy.decision === "BLOCK" && !ctx.input.force) {
          throw new Error(
            analyzePolicy.blockers[0] ?? "Policy blocked desk analyze.",
          );
        }

        const { prepareSecondBrainForCycle } = await import(
          "@/lib/second-brain/prepare-cycle"
        );
        const { getLoopGuardDashboardSnapshot } = await import(
          "@/lib/autopilot-loop-guard/run-guard"
        );
        const { evaluateRealTimeRisk } = await import(
          "@/lib/real-time-risk/evaluate-realtime-risk"
        );
        const { buildStrategyHealthSummary } = await import("@/lib/strategy-health");
        const { resolvePrimaryStrategyHealth } = await import(
          "@/lib/mission-flow/resolve-primary-strategy-health"
        );
        const { getPositions } = await import(
          "@/lib/exchange/binance/binance-futures-testnet"
        );

        const [loopGuard, riskReport, positions] = await Promise.all([
          getLoopGuardDashboardSnapshot(ctx.workspaceId).catch(() => null),
          Promise.resolve(
            evaluateRealTimeRisk({
              entries,
              orders,
            }),
          ).catch(() => null),
          getPositions().catch(() => []),
        ]);

        const strategySummary = buildStrategyHealthSummary({ entries, orders });
        const primaryStrategy = resolvePrimaryStrategyHealth(strategySummary);
        const openLabels = positions
          .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
          .map((p) => `${p.symbol} ${Number(p.positionAmt) > 0 ? "LONG" : "SHORT"}`);

        const blockers: string[] = [];
        if (loopGuard?.blocker.active && loopGuard.blocker.reason) {
          blockers.push(loopGuard.blocker.reason);
        }
        if (riskReport?.blockNewTrades && riskReport.triggeredLimits[0]) {
          blockers.push(riskReport.triggeredLimits[0]);
        }

        const secondBrainPrep = await prepareSecondBrainForCycle({
          entries,
          openPositionLabels: openLabels,
          currentStrategy: primaryStrategy?.strategyId ?? null,
          riskState: riskReport?.blockNewTrades
            ? riskReport.triggeredLimits[0] ?? "Risk paused"
            : "Within limits",
          blockers,
          workspaceId: ctx.workspaceId,
        });

        const cronInput = await loadCronAnalysisInput();
        const analysis = await runAnalyzeRequest({
          ...cronInput,
          secondBrain: secondBrainPrep.snapshot,
          secondBrainBullets: secondBrainPrep.bullets,
        } as Parameters<typeof runAnalyzeRequest>[0] & {
          secondBrain: typeof secondBrainPrep.snapshot;
          secondBrainBullets: string[];
        });
        const saved = await appendServerAnalysisFromResponse(analysis);
        ctx.analyze = analysis;

        const autopilot = await runAutopilotCycle({
          entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
          orders,
          perpPositions: server.perpPositions,
          riskProfile,
          latestAnalysis: analysis,
          settings: {
            ...DEFAULT_AUTOPILOT_SETTINGS,
            autopilotEnabled: true,
            paperAutopilotEnabled: false,
            shadowModeEnabled: false,
            mode: isTestnetPrimaryAutomation() ? "ANALYSIS_ONLY" : DEFAULT_AUTOPILOT_SETTINGS.mode,
            liveAutopilotEnabled: false,
            requireHumanApprovalForLive: true,
          },
          serverContext: await buildCommandCenterServerContext(),
        });
        ctx.autopilotResult = autopilot;

        const record = buildServerBackboneFromInput({
          entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
          orders,
          perpPositions: server.perpPositions,
          riskProfile,
          autopilotResult: autopilot,
        });
        await writeServerBackboneRecord(record);
        ctx.backboneHealth = record.health;

        await emitAnalyzePipelineEvents({
          runId: ctx.runId,
          analysis,
          autopilot,
          previewCreated: Boolean(autopilot.blockers.length === 0 && saved.entry.finalVerdict === "TRADE"),
        });

        await recordLoopGuardAction({
          actionType: "DESK_ANALYZE",
          actionKey: buildActionKey("DESK_ANALYZE", saved.entry.finalVerdict),
          success: true,
          failed: false,
          marketContextHash: buildMarketContextHash(analysis),
          runId: ctx.runId,
          summary: `Analyze ${saved.entry.finalVerdict}`,
        });

        return {
          summary: `Analyze ${saved.status} · ${saved.entry.finalVerdict} · autopilot ${autopilot.status}`,
        };
      });

    case "PORTFOLIO_SNAPSHOT":
      return runTimed(jobType, ctx, async () => {
        const snap = buildDeskPortfolioSnapshot(entries, orders);
        return {
          summary: `Open ${snap.paper.openCount} · realized ${snap.paper.totalRealizedPnlPct}%`,
        };
      });

    case "LEARNING_UPDATE":
      return runTimed(jobType, ctx, async () => {
        const ls = buildLearningStatus({
          entries,
          orders,
          riskProfile,
          latestAnalysis: ctx.analyze,
        });
        let autoLearned = 0;
        if (isBinanceTestnetAutoExecuteEnabled()) {
          const { autoMarkPendingLearningRecordsServer } = await import(
            "@/lib/testnet-monitor/learning-records-server"
          );
          const result = await autoMarkPendingLearningRecordsServer();
          autoLearned = result.marked;
        }
        const learnSuffix =
          autoLearned > 0 ? ` · auto-learned ${autoLearned}` : "";
        if (autoLearned > 0) {
          const { emitMissionAlert } = await import(
            "@/lib/mission-notifications/emit-mission-alert"
          );
          void emitMissionAlert({
            kind: "learning_ingested",
            title: "Autopilot ingested closed trades",
            body: `${autoLearned} trade(s) marked learned for strategy feedback.`,
          });
        }
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: `${ls.label} · samples ${ls.strategySampleSize}${learnSuffix}`,
        });

        return {
          summary: `${ls.label} · samples ${ls.strategySampleSize}${learnSuffix}`,
        };
      });

    case "PAPER_MONITOR":
      return runTimed(jobType, ctx, async () => {
        const open = orders.filter((o) => o.status === "OPEN");
        if (open.length === 0) {
          return { summary: "No open paper orders." };
        }
        const btc =
          ctx.analyze?.step1_marketSnapshot?.spotPrice ??
          open[0]?.lastMarkBtcPrice ??
          open[0]?.entryBtcPrice ??
          0;
        const marks = open.map((o) =>
          btc > 0 ? computeUnrealizedPnlPct(o, btc) : 0,
        );
        return {
          summary: `Monitored ${open.length} · uPnL ${marks.map((m) => m.toFixed(2)).join(", ")}%`,
        };
      });

    case "RISK_CHECK":
      return runTimed(jobType, ctx, async () => {
        const kill = evaluateKillSwitch({
          entries,
          orders,
          riskProfile,
          latestAnalysis: ctx.analyze,
        });
        const serverContext = await buildCommandCenterServerContext();
        const cc = buildCommandCenterReport({
          entries,
          orders,
          perpPositions: server.perpPositions,
          riskProfile,
          latestAnalysis: ctx.analyze,
          serverContext,
        });
        if (kill.tradingPaused) {
          return {
            summary: `Kill switch active · desk ${cc.status} · ${kill.messages[0] ?? "paused"}`,
          };
        }
        return {
          summary: `Risk OK · desk ${cc.status} · daily PnL ${kill.dailyPnlPct}%`,
        };
      });

    case "ACTION_QUEUE_REFRESH":
      return runTimed(jobType, ctx, async () => {
        const serverContext = await buildCommandCenterServerContext();
        const cc = buildCommandCenterReport({
          entries,
          orders,
          perpPositions: server.perpPositions,
          riskProfile,
          latestAnalysis: ctx.analyze,
          serverContext,
        });
        const actions = buildOperatorActionQueue({
          entries,
          orders,
          riskProfile,
          latestAnalysis: ctx.analyze,
          serverContext,
          commandBlockers: cc.blockers.map((b) => b.detail),
        });
        const open = actions.filter((a) => a.status === "OPEN");
        await mergeServerPendingOperatorActions(open);
        return { summary: `${open.length} operator action(s) refreshed.` };
      });

    case "COMMAND_CENTER_REFRESH":
      return runTimed(jobType, ctx, async () => {
        const serverContext = await buildCommandCenterServerContext();
        const baseReport = buildCommandCenterReport({
          entries,
          orders,
          perpPositions: server.perpPositions,
          riskProfile,
          latestAnalysis: ctx.analyze,
          serverContext,
        });
        const testnetPerp = await buildTestnetPerpDeskPanel();
        const report = applyTestnetPrimaryCommandCenterView(baseReport, testnetPerp);
        ctx.commandCenterStatus = report.operationalStatus ?? report.status;
        return {
          summary: `Desk ${report.operationalStatus ?? report.status} · ${report.blockers.length} blocker(s)`,
        };
      });

    case "NOTIFICATION_DIGEST":
      return runTimed(jobType, ctx, async () => {
        const verdict =
          ctx.autopilotResult?.finalVerdict ??
          ctx.analyze?.tradingDesk?.weightedCommittee?.weightedVerdict ??
          ctx.analyze?.step5_verdict?.recommendation ??
          "NONE";
        const message = sanitizeBriefingText(
          [
            "━━ BTC Desk · Automation Digest ━━",
            `Workspace: ${ctx.workspaceId}`,
            `Status: ${ctx.autopilotResult?.deskStatus ?? "—"}`,
            `Verdict: ${verdict}`,
            ctx.autopilotResult?.briefing ?? "",
            "",
            "Advisory only · no live auto-execution.",
          ].join("\n"),
        );
        const channels = await dispatchExternalBriefing({ message });
        const delivered = Object.entries(channels)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
        return {
          summary:
            delivered.length > 0
              ? `Digest via ${delivered.join(", ")}`
              : "Digest logged (no external channel)",
        };
      });

    case "BINANCE_TESTNET_MONITOR":
      return runTimed(jobType, ctx, async () => {
        const monitor = await runBinanceTestnetAutoMonitor({
          analysis: ctx.analyze,
        });
        if (monitor.closedCount > 0 && isBinanceTestnetAutoExecuteEnabled()) {
          const { autoMarkPendingLearningRecordsServer } = await import(
            "@/lib/testnet-monitor/learning-records-server"
          );
          const learned = await autoMarkPendingLearningRecordsServer();
          if (learned.marked > 0) {
            await emitAiStatusEvent({
              type: "LEARNING_UPDATED",
              runId: ctx.runId,
              detail: `Ingested ${learned.marked} closed testnet trade(s) after monitor.`,
            });
          }
        }
        if (monitor.outcome === "CLOSED") {
          await emitAiStatusEvent({
            type: "TRADE_CLOSED",
            runId: ctx.runId,
            detail: monitor.summary,
          });
        } else {
          await emitAiStatusEvent({
            type: "POSITION_MONITORED",
            runId: ctx.runId,
            detail: monitor.summary,
          });
        }
        return { summary: `${monitor.outcome} · ${monitor.summary}` };
      });

    case "BINANCE_TESTNET_AUTOEXECUTE":
      return runTimed(jobType, ctx, async () => {
        const auto = await runBinanceTestnetAutoExecute({
          analysis: ctx.analyze,
          entries,
          orders,
          commandCenterStatus: ctx.commandCenterStatus,
          runId: ctx.runId,
        });
        const executed = auto.outcome === "EXECUTED";
        await recordLoopGuardAction({
          actionType: "BINANCE_EXECUTE",
          actionKey: buildActionKey("BINANCE_EXECUTE", auto.outcome),
          success: executed,
          failed: !executed && auto.outcome !== "NO_TRADE_SIGNAL" && auto.outcome !== "DISABLED",
          apiErrorKey: buildApiErrorKey(auto.blockReasons[0] ?? auto.summary),
          tradeCandidateKey:
            auto.symbol && auto.side
              ? `${auto.symbol}:${auto.side}`
              : null,
          previewId: auto.previewId,
          runId: ctx.runId,
          summary: auto.summary,
        });
        if (executed) {
          await emitAiStatusEvent({
            type: "ORDER_EXECUTED",
            runId: ctx.runId,
            detail: auto.summary,
          });
        } else if (
          auto.outcome === "PREVIEW_BLOCKED" ||
          auto.outcome === "EXECUTE_BLOCKED" ||
          auto.outcome === "LOOP_GUARD_BLOCKED"
        ) {
          await emitAiStatusEvent({
            type: "PERMISSION_REQUESTED",
            runId: ctx.runId,
            detail: auto.summary,
          });
        } else if (auto.outcome === "NO_TRADE_SIGNAL") {
          await emitAiStatusEvent({
            type: "TRADE_CANDIDATE_CREATED",
            runId: ctx.runId,
            detail: "No trade signal this cycle",
          });
        }
        return { summary: `${auto.outcome} · ${auto.summary}` };
      });

    case "SELF_LEARNING_UPDATE":
      return runTimed(jobType, ctx, async () => {
        const { loadLearningRecordsServer } = await import(
          "@/lib/testnet-monitor/learning-records-server"
        );
        const { runTestnetLearningEvaluation } = await import(
          "@/lib/self-learning/run-testnet-learning-evaluation"
        );
        const records = await loadLearningRecordsServer();
        const result = await runTestnetLearningEvaluation({
          records,
          entries,
          limit: 10,
        });
        const calSummary =
          result.evaluated > 0
            ? await import("@/lib/confidence-calibration/run-calibration-update").then((m) =>
                m.runConfidenceCalibrationUpdate(ctx.workspaceId),
              )
            : null;
        return {
          summary:
            result.evaluated > 0
              ? `Evaluated ${result.evaluated} testnet trade(s) · top agent ${result.topAgent ?? "—"}${calSummary ? ` · cal ×${calSummary.profile.recommendedSizeMultiplier}` : ""}`
              : `No new evaluations (${result.skipped} skipped)`,
        };
      });

    case "SECOND_BRAIN_CONSOLIDATE":
      return runTimed(jobType, ctx, async () => {
        const { consolidateSecondBrain } = await import(
          "@/lib/second-brain/consolidate"
        );
        const { getLoopGuardDashboardSnapshot } = await import(
          "@/lib/autopilot-loop-guard/run-guard"
        );
        const { loadLearningRecordsServer } = await import(
          "@/lib/testnet-monitor/learning-records-server"
        );
        const [loopGuard, learningRecords] = await Promise.all([
          getLoopGuardDashboardSnapshot(ctx.workspaceId).catch(() => null),
          loadLearningRecordsServer().catch(() => []),
        ]);
        const result = await consolidateSecondBrain({
          entries,
          learningRecords,
          loopBlockerReason:
            loopGuard?.blocker.active ? loopGuard.blocker.reason : null,
        });
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: `Second brain: ${result.totalMemories} memories · ${result.conflictsResolved} conflicts resolved`,
          technical: "second-brain:consolidate",
        });
        return {
          summary: `Second brain +${result.added} · ${result.totalMemories} total · ${result.conflictsResolved} conflicts resolved`,
        };
      });

    case "TRADE_QUALITY_SCORE_UPDATE":
      return runTimed(jobType, ctx, async () => {
        const { runTradeQualityUpdate } = await import(
          "@/lib/trade-quality-score/run-quality-update"
        );
        const result = await runTradeQualityUpdate(ctx.workspaceId);
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: result.summary.headline,
          technical: "trade-quality-score",
        });
        return { summary: `${result.scored} scored · avg ${result.summary.avgCompositeScore}/100` };
      });

    case "CONFIDENCE_CALIBRATION_UPDATE":
      return runTimed(jobType, ctx, async () => {
        const { runConfidenceCalibrationUpdate } = await import(
          "@/lib/confidence-calibration/run-calibration-update"
        );
        const result = await runConfidenceCalibrationUpdate(ctx.workspaceId);
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: result.profile.headline,
          technical: "confidence-calibration",
        });
        return {
          summary: `${result.profile.totalSamples} samples · size ×${result.profile.recommendedSizeMultiplier}`,
        };
      });

    case "TRADE_BLACK_BOX_CAPTURE":
      return runTimed(jobType, ctx, async () => {
        const { runTradeBlackBoxCapture } = await import(
          "@/lib/trade-black-box/run-capture"
        );
        const result = await runTradeBlackBoxCapture(ctx.workspaceId);
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: `${result.captured} trade black box records captured`,
          technical: "trade-black-box",
        });
        return {
          summary: `${result.captured} captured · ${result.failed} skipped`,
        };
      });

    case "CONTINUOUS_IMPROVEMENT_DETECT":
      return runTimed(jobType, ctx, async () => {
        const { runContinuousImprovementDetect } = await import(
          "@/lib/continuous-improvement-loop/run-detect-cycle"
        );
        const result = await runContinuousImprovementDetect(ctx.workspaceId);
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: `${result.detected} issues · ${result.proposals.length} proposals`,
          technical: "continuous-improvement-loop",
        });
        return {
          summary: `${result.detected} detected · ${result.proposals.length} proposals`,
        };
      });

    case "DAILY_SELF_REVIEW":
      return runTimed(jobType, ctx, async () => {
        const { runDailySelfReview } = await import("@/lib/daily-self-review/run-daily-self-review");
        const result = await runDailySelfReview({
          workspaceId: ctx.workspaceId,
          trigger: "automation",
          force: false,
        });
        if (result.skipped) {
          return { summary: result.reason ?? "Daily self-review not due yet." };
        }
        const score = result.record?.dailyScore ?? "—";
        await emitAiStatusEvent({
          type: "LEARNING_UPDATED",
          runId: ctx.runId,
          detail: `Daily AI score ${score}/100 · ${result.record?.lessonLearned?.slice(0, 80) ?? "review complete"}`,
          technical: "daily-self-review",
        });
        return {
          summary: `Daily AI score ${score}/100 · ${result.record?.date ?? "today"}`,
        };
      });

    case "PROJECT_STRATEGIST_REVIEW":
      return runTimed(jobType, ctx, async () => {
        const status = await getProjectStrategistStatus(ctx.workspaceId);
        const now = Date.now();
        const nextDaily = status.state.nextDailyReviewAt
          ? Date.parse(status.state.nextDailyReviewAt)
          : 0;
        const nextWeekly = status.state.nextWeeklyReviewAt
          ? Date.parse(status.state.nextWeeklyReviewAt)
          : 0;
        const shouldWeekly = nextWeekly > 0 && now >= nextWeekly;
        const shouldDaily = nextDaily <= 0 || now >= nextDaily;
        if (!shouldDaily && !shouldWeekly) {
          return { summary: "Strategist review not due yet." };
        }
        const strategist = await runProjectStrategist({
          workspaceId: ctx.workspaceId,
          trigger: shouldWeekly ? "weekly" : "daily",
          latestUserGoal:
            "Propose one one-day MVP that improves execution-readiness and UX simplicity without enabling live trading.",
        });
        return {
          summary: `Strategist ${strategist.report.projectHealthStatus} · MVP ${strategist.report.recommendedMVP.title}`,
        };
      });

    default:
      return toAutomationJob({
        jobType,
        runId: ctx.runId,
        workspaceId: ctx.workspaceId,
        status: "SKIPPED",
        idempotencyKey: idempotencyKey(ctx.workspaceId, jobType, ctx.runId),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        resultSummary: "Unknown job type.",
        error: null,
      });
  }
}
