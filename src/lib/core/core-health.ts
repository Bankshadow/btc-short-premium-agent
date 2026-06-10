import { hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { resolveTestnetConnectionStatus } from "@/lib/execution/testnet-status";
import { runEngineHealthCheck } from "@/lib/health/engine-health-check";
import { buildPortfolioRiskView } from "@/lib/portfolio-risk/portfolio-risk-manager";
import { readCoreEvents } from "./event-store";
import { validateEventBatch } from "./event-validator";
import { buildAllProjections } from "./projection-engine";
import type { CoreValidationIssue } from "./core-errors";

export interface CoreHealthIssue {
  code: string;
  message: string;
  severity: "WARNING" | "BLOCK";
}

export interface CoreHealthReport {
  status: "OK" | "WARNING" | "BLOCKED";
  eventJournalStatus: "OK" | "WARNING" | "BLOCKED";
  projectionStatus: "OK" | "WARNING" | "BLOCKED";
  lifecycleStatus: "OK" | "WARNING" | "BLOCKED";
  riskStatus: "SAFE" | "DEFENSIVE" | "BLOCKED";
  exchangeStatus: string;
  operatorStatus: string;
  safetyStatus: "OK" | "BLOCKED";
  blockingIssues: CoreHealthIssue[];
  warnings: CoreHealthIssue[];
  lastCheckedAt: string;
  liveLocked: true;
}

function toHealthIssue(i: CoreValidationIssue): CoreHealthIssue {
  return {
    code: i.code,
    message: i.message,
    severity: i.severity === "ERROR" ? "BLOCK" : "WARNING",
  };
}

export async function evaluateCoreHealth(): Promise<CoreHealthReport> {
  await hydrateOperatorGateState();
  const events = await readCoreEvents();
  const validationIssues = validateEventBatch(events, { checkLifecycle: true });

  let projectionStatus: CoreHealthReport["projectionStatus"] = "OK";
  try {
    buildAllProjections(events, { bustCache: true });
  } catch {
    projectionStatus = "BLOCKED";
  }

  const engine = await runEngineHealthCheck();
  const portfolio = await buildPortfolioRiskView();
  const testnet = await resolveTestnetConnectionStatus();

  const blockingIssues: CoreHealthIssue[] = [];
  const warnings: CoreHealthIssue[] = [];

  for (const issue of validationIssues.map(toHealthIssue)) {
    if (issue.severity === "BLOCK") blockingIssues.push(issue);
    else warnings.push(issue);
  }

  if (engine.blocksExecution) {
    for (const i of engine.issues) {
      blockingIssues.push({ code: i.code, message: i.message, severity: "BLOCK" });
    }
  } else {
    for (const i of engine.issues) {
      warnings.push({ code: i.code, message: i.message, severity: "WARNING" });
    }
  }

  if (portfolio.blocksExecution) {
    blockingIssues.push({
      code: "PORTFOLIO_RISK",
      message: portfolio.message,
      severity: "BLOCK",
    });
  }

  if (isLiveEnabled()) {
    blockingIssues.push({
      code: "LIVE_ENABLED",
      message: "Live trading flag must remain false.",
      severity: "BLOCK",
    });
  }

  const lifecycleStatus: CoreHealthReport["lifecycleStatus"] = validationIssues.some(
    (i) => i.severity === "ERROR",
  )
    ? "BLOCKED"
    : validationIssues.some((i) => i.severity === "WARNING")
      ? "WARNING"
      : "OK";

  const eventJournalStatus = lifecycleStatus;
  const riskStatus: CoreHealthReport["riskStatus"] = portfolio.blocksExecution
    ? "BLOCKED"
    : portfolio.issues.some((i) => i.severity === "WARNING")
      ? "DEFENSIVE"
      : "SAFE";

  const status: CoreHealthReport["status"] =
    blockingIssues.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "OK";

  return {
    status,
    eventJournalStatus,
    projectionStatus,
    lifecycleStatus,
    riskStatus,
    exchangeStatus: testnet.connected ? "CONNECTED" : testnet.reason ?? "DISCONNECTED",
    operatorStatus: portfolio.message.includes("Kill") ? "KILL_SWITCH" : "ACTIVE",
    safetyStatus: isLiveEnabled() || engine.blocksExecution ? "BLOCKED" : "OK",
    blockingIssues,
    warnings,
    lastCheckedAt: new Date().toISOString(),
    liveLocked: true,
  };
}

export async function isCoreHealthBlockingExecution(): Promise<boolean> {
  const health = await evaluateCoreHealth();
  return health.status === "BLOCKED";
}
