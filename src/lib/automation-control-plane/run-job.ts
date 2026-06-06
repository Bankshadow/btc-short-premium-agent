import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { runAutopilotCycle } from "@/lib/autopilot/run-autopilot";
import { DEFAULT_AUTOPILOT_SETTINGS } from "@/lib/autopilot/config";
import { buildLearningStatus } from "@/lib/autopilot/build-learning-status";
import { buildOperatorActionQueue } from "@/lib/operator-action-queue/build-action-queue";
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

export type AutomationJobContext = {
  runId: string;
  workspaceId: string;
  input: AutomationRunInput;
  server: AutomationServerContext;
  analyze: AnalyzeApiResponse | null;
  autopilotResult: AutopilotRunResult | null;
  backboneHealth: DeskBackboneHealth | null;
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

    case "DESK_ANALYZE":
      return runTimed(jobType, ctx, async () => {
        const eval_ = await evaluateServerBackboneHealth();
        ctx.backboneHealth = eval_.health;
        if (
          eval_.health &&
          !eval_.healthy &&
          !ctx.input.force
        ) {
          throw new Error(
            eval_.health.writeBlockers[0] ??
              eval_.health.staleWarning ??
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

        const cronInput = await loadCronAnalysisInput();
        const analysis = await runAnalyzeRequest(cronInput);
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
        const report = buildCommandCenterReport({
          entries,
          orders,
          perpPositions: server.perpPositions,
          riskProfile,
          latestAnalysis: ctx.analyze,
          serverContext,
        });
        return {
          summary: `Desk ${report.status} · ${report.blockers.length} blocker(s)`,
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
        return { summary: `${monitor.outcome} · ${monitor.summary}` };
      });

    case "BINANCE_TESTNET_AUTOEXECUTE":
      return runTimed(jobType, ctx, async () => {
        const auto = await runBinanceTestnetAutoExecute({
          analysis: ctx.analyze,
          entries,
          orders,
          commandCenterStatus: null,
        });
        return { summary: `${auto.outcome} · ${auto.summary}` };
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
