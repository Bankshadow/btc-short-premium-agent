import {
  loadAutomationState,
  loadFailedAutomationJobs,
  loadServerPendingOperatorActions,
} from "@/lib/automation-control-plane/state-store";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { buildStrategyHealthSummary } from "@/lib/strategy-health";
import { buildStrategyHealthInputServer } from "@/lib/strategy-health/build-server-context";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import type { AutomationStatusSnapshot } from "@/lib/automation-control-plane/types";
import fs from "fs/promises";
import path from "path";

export interface ProjectStrategistContext {
  functionalSummary: string;
  routeList: string[];
  apiList: string[];
  featureStatus: string[];
  knownGaps: string[];
  /** MVP 79 — integrated daily self-review suggested Cursor task. */
  suggestedDailyReviewTask: string | null;
  strategyHealthSummary: {
    totalStrategies: number;
    reviewRequired: number;
    paused: number;
    candidateForLive: number;
  } | null;
  latestDecisionLogs: DecisionLogEntry[];
  latestTestnetMonitor: TestnetMonitorSnapshot | null;
  latestPortfolioSummary: ReturnType<typeof buildDeskPortfolioSnapshot> | null;
  latestAutomationStatus: AutomationStatusSnapshot | null;
}

async function loadAutomationSnapshot(): Promise<AutomationStatusSnapshot> {
  const [state, failedJobs, pendingOperatorActions] = await Promise.all([
    loadAutomationState("server-default"),
    loadFailedAutomationJobs(),
    loadServerPendingOperatorActions(),
  ]);
  const activeJobs =
    state.lastRun?.status === "RUNNING"
      ? state.lastRun.jobs.filter((j) => j.status === "RUNNING")
      : [];
  return {
    state,
    activeJobs,
    failedJobs,
    pendingOperatorActions,
  };
}

async function listFilesRecursive(baseDir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function listRoutesAndApis(): Promise<{ routes: string[]; apis: string[] }> {
  const appRoot = path.join(process.cwd(), "src", "app");
  const allFiles = await listFilesRecursive(appRoot);
  const pages = allFiles
    .filter((file) => file.endsWith(`${path.sep}page.tsx`))
    .map((file) => path.relative(process.cwd(), file).replaceAll("\\", "/"));
  const routes = pages
    .map((file) =>
      file
        .replace(/^src\/app/, "")
        .replace(/\/page\.tsx$/, "")
        .replace(/^\//, "") || "/",
    )
    .map((route) => (route === "" ? "/" : `/${route}`))
    .sort();

  const apiRouteFiles = allFiles
    .filter((file) => file.endsWith(`${path.sep}route.ts`))
    .map((file) => path.relative(process.cwd(), file).replaceAll("\\", "/"))
    .filter((file) => file.startsWith("src/app/api/"));
  const apis = apiRouteFiles
    .map((file) =>
      file
        .replace(/^src\/app\/api/, "")
        .replace(/\/route\.ts$/, ""),
    )
    .map((route) => `/api${route}`)
    .sort();

  return { routes, apis };
}

function detectFeatureStatus(input: {
  routes: string[];
  latestTestnetMonitor: TestnetMonitorSnapshot | null;
  automationStatus: AutomationStatusSnapshot | null;
  strategyHealthSummary: ProjectStrategistContext["strategyHealthSummary"];
}): string[] {
  const statuses: string[] = [];
  const hasMonitor = input.routes.includes("/testnet-monitor");
  statuses.push(
    hasMonitor
      ? "Testnet monitor dashboard available."
      : "Testnet monitor dashboard missing.",
  );
  if (input.latestTestnetMonitor?.connected) {
    statuses.push("Binance testnet connectivity healthy.");
  } else {
    statuses.push("Binance testnet connectivity degraded.");
  }
  if (input.latestTestnetMonitor?.validationMetricsSegment) {
    statuses.push(
      `TESTNET learning metrics ready (${input.latestTestnetMonitor.validationMetricsSegment.learnedCount} learned).`,
    );
  }
  const automation = input.automationStatus?.state.settings;
  if (automation?.automationEnabled && !automation.paused) {
    statuses.push("Automation control plane enabled.");
  } else {
    statuses.push("Automation control plane paused or disabled.");
  }
  if (input.strategyHealthSummary) {
    statuses.push(
      `Strategy health dashboard ready (${input.strategyHealthSummary.totalStrategies} strategies, ${input.strategyHealthSummary.reviewRequired} review-required).`,
    );
  }
  return statuses;
}

function detectKnownGaps(input: {
  routes: string[];
  latestDecisionLogs: DecisionLogEntry[];
  latestTestnetMonitor: TestnetMonitorSnapshot | null;
  automationStatus: AutomationStatusSnapshot | null;
  strategyHealthSummary: ProjectStrategistContext["strategyHealthSummary"];
}): string[] {
  const gaps: string[] = [];
  if (!input.routes.includes("/project-strategist")) {
    gaps.push("Project strategist UX not yet visible in operator navigation.");
  }
  if ((input.latestDecisionLogs ?? []).length === 0) {
    gaps.push("Decision logs are empty — learning loops have low evidence.");
  }
  if (!input.latestTestnetMonitor?.connected) {
    gaps.push("Testnet monitor disconnected — execution loop confidence is low.");
  }
  if ((input.latestTestnetMonitor?.validationMetricsSegment.learnedCount ?? 0) === 0) {
    gaps.push("No TESTNET learning records marked as learned yet.");
  }
  if (!input.automationStatus?.state.lastRun) {
    gaps.push("Automation has no recent successful server run.");
  }
  if ((input.automationStatus?.pendingOperatorActions ?? []).length > 8) {
    gaps.push("Operator action queue is noisy and likely overwhelming.");
  }
  if ((input.strategyHealthSummary?.paused ?? 0) > 0) {
    gaps.push(
      `${input.strategyHealthSummary?.paused ?? 0} strategy(ies) paused by health logic — run risk replay before promotion.`,
    );
  }
  return gaps;
}

export async function buildProjectStrategistContext(): Promise<ProjectStrategistContext> {
  const { routes, apis } = await listRoutesAndApis();
  const [latestDecisionLogs, latestAutomationStatus, latestTestnetMonitor, strategyHealthInput] =
    await Promise.all([
      loadServerAnalysisJournal(),
      loadAutomationSnapshot().catch(() => null),
      buildTestnetMonitorSnapshot().catch(() => null),
      buildStrategyHealthInputServer().catch(() => null),
    ]);
  const strategyHealth = strategyHealthInput
    ? buildStrategyHealthSummary(strategyHealthInput)
    : null;
  const strategyHealthSummary = strategyHealth
    ? {
        totalStrategies: strategyHealth.totals.strategies,
        reviewRequired: strategyHealth.totals.reviewRequired,
        paused: strategyHealth.totals.paused,
        candidateForLive: strategyHealth.totals.candidateForLive,
      }
    : null;

  const latestPortfolioSummary =
    latestDecisionLogs.length > 0
      ? buildDeskPortfolioSnapshot(latestDecisionLogs, [])
      : null;

  return {
    functionalSummary:
      "BTC short-premium desk with multi-agent analysis, paper/testnet loops, governance, and automation.",
    routeList: routes,
    apiList: apis,
    suggestedDailyReviewTask:
      latestTestnetMonitor?.integratedDailySelfReview?.review?.suggestedCursorTask ?? null,
    featureStatus: detectFeatureStatus({
      routes,
      latestTestnetMonitor,
      automationStatus: latestAutomationStatus,
      strategyHealthSummary,
    }),
    knownGaps: detectKnownGaps({
      routes,
      latestDecisionLogs,
      latestTestnetMonitor,
      automationStatus: latestAutomationStatus,
      strategyHealthSummary,
    }),
    strategyHealthSummary,
    latestDecisionLogs: latestDecisionLogs.slice(0, 30),
    latestTestnetMonitor,
    latestPortfolioSummary,
    latestAutomationStatus,
  };
}
