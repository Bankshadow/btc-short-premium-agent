import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import { buildTestnetPrimaryCommandCenterReport } from "@/lib/command-center/apply-testnet-primary-view";
import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildLearningStatus } from "./build-learning-status";
import { buildOperatorActionQueue } from "@/lib/operator-action-queue/build-action-queue";
import type { AutopilotModuleId, AutopilotModuleResult, AutopilotRunInput } from "./types";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";

function emptyServerContext(): ServerReadinessContext {
  return {
    exchangeStatus: {
      configured: false,
      connected: false,
      network: null,
      timestamp: new Date().toISOString(),
      serverTimeMs: null,
      clockSkewMs: null,
      wallet: null,
      linearPositions: [],
      optionPositions: [],
      openLinearOrders: [],
      openOptionOrders: [],
      trackedSymbols: [],
      disclaimer: "Read-only exchange connector.",
    },
    liveExecution: {
      enabled: false,
      configured: false,
      network: null,
      requireDoubleConfirm: true,
    },
    maxLiveNotionalUsd: 500,
    cronSecretConfigured: false,
    supabaseConfigured: false,
    telegramConfigured: false,
    discordEnvConfigured: false,
    deskWebhookConfigured: false,
    llmConfigured: false,
    serverAutomationAllowed: false,
    timestamp: new Date().toISOString(),
  };
}

async function runTimed(
  moduleId: AutopilotModuleId,
  fn: () => Promise<{ summary: string; details?: string; display: boolean }>,
): Promise<AutopilotModuleResult> {
  const start = Date.now();
  try {
    const out = await fn();
    return {
      moduleId,
      status: "OK",
      summary: out.summary,
      details: out.details,
      shouldDisplayToUser: out.display,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Module failed";
    return {
      moduleId,
      status: "ERROR",
      summary: message,
      error: message,
      shouldDisplayToUser: true,
      durationMs: Date.now() - start,
    };
  }
}

export async function runAutopilotModules(input: {
  runInput: AutopilotRunInput;
  modules: AutopilotModuleId[];
}): Promise<{
  results: AutopilotModuleResult[];
  skipped: AutopilotModuleId[];
  portfolioBrief: import("./types").PortfolioSnapshotBrief;
  learningStatus: import("./types").LearningStatus;
  deskStatus: import("@/lib/command-center/types").CommandCenterStatus;
  blockers: string[];
  actions: import("@/lib/operator-action-queue/types").OperatorAction[];
}> {
  const entries = input.runInput.entries ?? [];
  const orders = input.runInput.orders ?? [];
  const riskProfile = input.runInput.riskProfile ?? "balanced";
  const latestAnalysis = input.runInput.latestAnalysis ?? null;
  const serverContext = input.runInput.serverContext ?? emptyServerContext();

  const results: AutopilotModuleResult[] = [];
  const skipped: AutopilotModuleId[] = [];
  const allModules: AutopilotModuleId[] = [
    "analyze",
    "portfolio",
    "validation",
    "strategy_registry",
    "learning",
    "action_queue",
    "alert_check",
    "sync_check",
    "command_center",
  ];

  for (const id of allModules) {
    if (!input.modules.includes(id)) {
      skipped.push(id);
      continue;
    }

    if (id === "analyze") {
      if (input.runInput.skipAnalyze || !latestAnalysis) {
        results.push({
          moduleId: id,
          status: "SKIPPED",
          summary: "Analyze skipped — no fresh snapshot in this cycle.",
          shouldDisplayToUser: false,
          durationMs: 0,
        });
        continue;
      }
      const verdict =
        latestAnalysis.tradingDesk?.weightedCommittee?.weightedVerdict ??
        latestAnalysis.step5_verdict?.recommendation ??
        "WAIT";
      const confidence =
        latestAnalysis.step5_verdict?.confidence ??
        latestAnalysis.tradingDesk?.weightedCommittee?.tradeScore ??
        0;
      results.push({
        moduleId: id,
        status: "OK",
        summary: `Verdict ${verdict} · score ${confidence}`,
        shouldDisplayToUser: true,
        durationMs: 0,
      });
      continue;
    }

    if (id === "portfolio") {
      results.push(
        await runTimed(id, async () => {
          const p = buildDeskPortfolioSnapshot(entries, orders);
          return {
            summary: `Paper PnL ${p.netLogPaperPnlPct}% · ${p.paper.closedCount} closed`,
            details: `Open ${p.paper.openCount}`,
            display: false,
          };
        }),
      );
      continue;
    }

    if (id === "validation") {
      results.push(
        await runTimed(id, async () => {
          const v = buildValidationReport({
            entries,
            orders,
            riskProfile,
            latestAnalysis,
          });
          const active = v.strategyMatrix.filter((r) => r.status === "ACTIVE").length;
          return {
            summary: `${active} ACTIVE strategies · regime ${v.currentRegimeLabel}`,
            display: false,
          };
        }),
      );
      continue;
    }

    if (id === "strategy_registry") {
      results.push(
        await runTimed(id, async () => {
          const reg = buildStrategyRegistry({ entries, orders, riskProfile });
          return {
            summary: `${reg.strategies.length} strategies tracked`,
            display: false,
          };
        }),
      );
      continue;
    }

    if (id === "learning") {
      results.push(
        await runTimed(id, async () => {
          const ls = buildLearningStatus({
            entries,
            orders,
            riskProfile,
            latestAnalysis,
          });
          return {
            summary: ls.label,
            details: ls.detail,
            display: ls.resolvedOutcomesCount === 0,
          };
        }),
      );
      continue;
    }

    if (id === "alert_check") {
      const anyChannel =
        serverContext.telegramConfigured ||
        serverContext.discordEnvConfigured ||
        serverContext.deskWebhookConfigured;
      results.push({
        moduleId: id,
        status: anyChannel ? "OK" : "BLOCKED",
        summary: anyChannel
          ? "Alert channels configured."
          : "Reliability setup incomplete: alerts not configured.",
        shouldDisplayToUser: !anyChannel,
        durationMs: 0,
      });
      continue;
    }

    if (id === "sync_check") {
      results.push({
        moduleId: id,
        status: serverContext.supabaseConfigured ? "OK" : "BLOCKED",
        summary: serverContext.supabaseConfigured
          ? "Cloud sync configured."
          : "Reliability setup incomplete: cloud sync is not configured.",
        shouldDisplayToUser: !serverContext.supabaseConfigured,
        durationMs: 0,
      });
      continue;
    }

    if (id === "command_center") {
      results.push(
        await runTimed(id, async () => {
          const report = isTestnetPrimaryAutomation()
            ? await buildTestnetPrimaryCommandCenterReport({
                entries,
                orders,
                perpPositions: input.runInput.perpPositions,
                riskProfile,
                latestAnalysis,
                serverContext,
              })
            : buildCommandCenterReport({
                entries,
                orders,
                perpPositions: input.runInput.perpPositions,
                riskProfile,
                latestAnalysis,
                serverContext,
              });
          return {
            summary: `${report.operationalStatus ?? report.status} — ${report.operationalStatusLabel ?? report.statusLabel}`,
            details: report.blockers.slice(0, 2).map((b) => b.detail).join("; "),
            display:
              (report.operationalStatus ?? report.status) === "BLOCKED" ||
              (report.operationalStatus ?? report.status) === "EMERGENCY",
          };
        }),
      );
      continue;
    }

    if (id === "action_queue") {
      results.push(
        await runTimed(id, async () => {
          const queue = buildOperatorActionQueue({
            entries,
            orders,
            riskProfile,
            latestAnalysis,
            serverContext,
          });
          return {
            summary: `${queue.filter((a) => a.status === "OPEN").length} open operator action(s)`,
            display: queue.some((a) => a.priority === "CRITICAL" || a.priority === "HIGH"),
          };
        }),
      );
    }
  }

  const portfolio = buildDeskPortfolioSnapshot(entries, orders);
  const learningStatus = buildLearningStatus({
    entries,
    orders,
    riskProfile,
    latestAnalysis,
  });
  const commandReport = isTestnetPrimaryAutomation()
    ? await buildTestnetPrimaryCommandCenterReport({
        entries,
        orders,
        perpPositions: input.runInput.perpPositions,
        riskProfile,
        latestAnalysis,
        serverContext,
      })
    : buildCommandCenterReport({
        entries,
        orders,
        perpPositions: input.runInput.perpPositions,
        riskProfile,
        latestAnalysis,
        serverContext,
      });
  const actions = buildOperatorActionQueue({
    entries,
    orders,
    riskProfile,
    latestAnalysis,
    serverContext,
    commandBlockers: commandReport.blockers.map((b) => b.detail),
  });

  return {
    results,
    skipped,
    portfolioBrief: {
      paperPnlPct: portfolio.netLogPaperPnlPct,
      openPaperTrades: portfolio.paper.openCount,
      sampleSize: learningStatus.strategySampleSize,
      drawdownPct: Math.abs(Math.min(0, portfolio.netLogPaperPnlPct)),
      exposureUsd: orders
        .filter((o) => o.status === "OPEN")
        .reduce((s, o) => s + o.notionalUsd, 0),
    },
    learningStatus,
    deskStatus: commandReport.operationalStatus ?? commandReport.status,
    blockers: commandReport.blockers.map((b) => b.detail),
    actions,
  };
}
