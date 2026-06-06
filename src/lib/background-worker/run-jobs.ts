import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { runAutopilotCycle } from "@/lib/autopilot/run-autopilot";
import { DEFAULT_AUTOPILOT_SETTINGS } from "@/lib/autopilot/config";
import { buildLearningStatus } from "@/lib/autopilot/build-learning-status";
import { buildOperatorActionQueue } from "@/lib/operator-action-queue/build-action-queue";
import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { appendServerAnalysisFromResponse, loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { dispatchExternalBriefing, sanitizeBriefingText } from "@/lib/smart-briefing/dispatch";
import { computeUnrealizedPnlPct } from "@/lib/paper/paper-pnl-engine";
import type {
  WorkerJobResult,
  WorkerJobType,
  WorkerRunInput,
} from "./types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { DeskBackboneHealth } from "@/lib/data-backbone/types";
import {
  buildServerBackboneFromInput,
  evaluateServerBackboneHealth,
  writeServerBackboneRecord,
} from "./server-backbone";

function jobKey(jobType: WorkerJobType, runId: string): string {
  return `${jobType}:${runId}`;
}

async function runTimedJob(
  jobType: WorkerJobType,
  runId: string,
  fn: () => Promise<{ summary: string }>,
): Promise<WorkerJobResult> {
  const start = Date.now();
  try {
    const { summary } = await fn();
    return {
      jobType,
      status: "OK",
      durationMs: Date.now() - start,
      summary,
      idempotencyKey: jobKey(jobType, runId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    return {
      jobType,
      status: "ERROR",
      durationMs: Date.now() - start,
      summary: message,
      error: message,
      idempotencyKey: jobKey(jobType, runId),
    };
  }
}

export type WorkerJobContext = {
  runId: string;
  input: WorkerRunInput;
  analyze: AnalyzeApiResponse | null;
  autopilotResult: AutopilotRunResult | null;
  backboneHealth: DeskBackboneHealth | null;
};

export async function runWorkerJob(
  jobType: WorkerJobType,
  ctx: WorkerJobContext,
): Promise<WorkerJobResult> {
  const { runId, input } = ctx;
  const entries = input.entries ?? (await loadServerAnalysisJournal());
  const orders = input.orders ?? [];
  const riskProfile = input.riskProfile ?? "balanced";

  switch (jobType) {
    case "DATA_HEALTH_CHECK": {
      return runTimedJob(jobType, runId, async () => {
        const eval_ = await evaluateServerBackboneHealth();
        ctx.backboneHealth = eval_.health;
        if (!eval_.health) {
          return { summary: "No server backbone yet — first cycle will create one." };
        }
        return {
          summary: eval_.healthy
            ? "Backbone healthy."
            : `Backbone unhealthy: ${eval_.health.writeBlockers.join("; ") || eval_.health.staleWarning}`,
        };
      });
    }

    case "DESK_ANALYZE_CYCLE": {
      return runTimedJob(jobType, runId, async () => {
        const cronInput = await loadCronAnalysisInput();
        const analysis = await runAnalyzeRequest(cronInput);
        const saved = await appendServerAnalysisFromResponse(analysis);
        ctx.analyze = analysis;

        const autopilot = await runAutopilotCycle({
          entries: [...entries.filter((e) => e.id !== saved.entry.id), saved.entry],
          orders,
          perpPositions: input.perpPositions,
          riskProfile,
          latestAnalysis: analysis,
          settings: {
            ...DEFAULT_AUTOPILOT_SETTINGS,
            ...input.settings,
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
          perpPositions: input.perpPositions,
          riskProfile,
          autopilotResult: autopilot,
        });
        await writeServerBackboneRecord(record);
        ctx.backboneHealth = record.health;

        return {
          summary: `Analyze ${saved.status} · verdict ${saved.entry.finalVerdict} · autopilot ${autopilot.status}`,
        };
      });
    }

    case "PORTFOLIO_SNAPSHOT": {
      return runTimedJob(jobType, runId, async () => {
        const snap = buildDeskPortfolioSnapshot(entries, orders);
        return {
          summary: `Paper open ${snap.paper.openCount} · PnL ${snap.paper.totalRealizedPnlPct}%`,
        };
      });
    }

    case "LEARNING_UPDATE": {
      return runTimedJob(jobType, runId, async () => {
        const ls = buildLearningStatus({ entries, orders, riskProfile });
        return { summary: `${ls.label} · sample ${ls.strategySampleSize}` };
      });
    }

    case "ACTION_QUEUE_UPDATE": {
      return runTimedJob(jobType, runId, async () => {
        const actions = buildOperatorActionQueue({ entries, orders, riskProfile });
        return { summary: `${actions.length} operator action(s) queued.` };
      });
    }

    case "COMMAND_CENTER_CHECK": {
      return runTimedJob(jobType, runId, async () => {
        const serverContext = await buildCommandCenterServerContext();
        const report = buildCommandCenterReport({
          entries,
          orders,
          perpPositions: input.perpPositions ?? [],
          riskProfile,
          latestAnalysis: ctx.analyze,
          serverContext,
        });
        return {
          summary: `Desk ${report.status} · ${report.statusLabel.slice(0, 80)}`,
        };
      });
    }

    case "PAPER_MONITOR": {
      return runTimedJob(jobType, runId, async () => {
        const open = orders.filter((o) => o.status === "OPEN");
        if (open.length === 0) {
          return { summary: "No open paper orders to monitor." };
        }
        const btc =
          ctx.analyze?.step1_marketSnapshot.spotPrice ??
          open[0]?.lastMarkBtcPrice ??
          open[0]?.entryBtcPrice ??
          0;
        const marks = open.map((o) => ({
          id: o.id,
          pnl: btc > 0 ? computeUnrealizedPnlPct(o, btc) : 0,
        }));
        return {
          summary: `Monitored ${open.length} open trade(s) · BTC ${btc} · uPnL ${marks.map((m) => m.pnl).join(", ")}%`,
        };
      });
    }

    case "NOTIFICATION_DIGEST": {
      return runTimedJob(jobType, runId, async () => {
        const verdict =
          ctx.autopilotResult?.finalVerdict ??
          ctx.analyze?.tradingDesk?.committee.finalVerdict ??
          "NONE";
        const message = sanitizeBriefingText(
          [
            "━━ BTC Desk · Worker Digest ━━",
            `Status: ${ctx.autopilotResult?.deskStatus ?? "—"}`,
            `Verdict: ${verdict}`,
            `Action: ${ctx.autopilotResult?.recommendedAction ?? "—"}`,
            ctx.autopilotResult?.briefing ?? "",
            "",
            "Advisory only · no auto-execution.",
          ].join("\n"),
        );
        const channels = await dispatchExternalBriefing({ message });
        const delivered = Object.entries(channels)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
        return {
          summary:
            delivered.length > 0
              ? `Digest sent via ${delivered.join(", ")}.`
              : "Digest stored in-app only (no external channel configured).",
        };
      });
    }

    default:
      return {
        jobType,
        status: "SKIPPED",
        durationMs: 0,
        summary: "Unknown job type.",
        idempotencyKey: jobKey(jobType, runId),
      };
  }
}
