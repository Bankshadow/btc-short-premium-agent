import type { AuditDiagnosis, StrategistAgentInput } from "./types";

function countRoutesByPrefix(routes: string[], prefix: string): number {
  return routes.filter((r) => r === prefix || r.startsWith(`${prefix}/`)).length;
}

export function runProjectAuditorAgent(input: StrategistAgentInput): AuditDiagnosis {
  const ctx = input.context;
  const routeCount = ctx.routeList.length;
  const apiCount = ctx.apiList.length;
  const decisionLogCount = ctx.latestDecisionLogs.length;
  const monitorConnected = Boolean(ctx.latestTestnetMonitor?.connected);
  const automationHasRun = Boolean(ctx.latestAutomationStatus?.state.lastRun);
  const pendingActions = ctx.latestAutomationStatus?.pendingOperatorActions.length ?? 0;

  const cockpitRoutes = countRoutesByPrefix(ctx.routeList, "/");
  const automationRoutes = countRoutesByPrefix(ctx.routeList, "/automation");
  const monitorRoutes = countRoutesByPrefix(ctx.routeList, "/testnet-monitor");

  const topProblems: string[] = [];
  const hiddenRisks: string[] = [];

  if (!monitorConnected) topProblems.push("Testnet monitor/execution feedback loop is disconnected.");
  if (!automationHasRun) topProblems.push("Server automation loop has not produced recent runs.");
  if (decisionLogCount < 5) topProblems.push("Learning loop has low sample size from decision logs.");
  if (pendingActions > 8) topProblems.push("Operator queue is noisy and likely causing action paralysis.");
  if (routeCount > 45) topProblems.push("Cockpit surface is too wide; primary vs advanced paths are mixed.");

  if (apiCount > 90) hiddenRisks.push("Large API surface raises maintenance and discoverability overhead.");
  if (cockpitRoutes > 20) hiddenRisks.push("Too many visible modules can hide critical daily workflow paths.");
  if (automationRoutes > 1 && !automationHasRun) {
    hiddenRisks.push("Automation controls exist but trust is low without stable run history.");
  }
  if (monitorRoutes > 0 && !monitorConnected) {
    hiddenRisks.push("Trading readiness appears available in UI while core monitor loop is degraded.");
  }

  const redSignals = Number(!monitorConnected) + Number(!automationHasRun);
  const projectHealthStatus =
    redSignals >= 2 ? "RED" : topProblems.length >= 3 ? "YELLOW" : "GREEN";

  return {
    projectHealthStatus,
    productDiagnosis:
      "Platform is feature-rich with strong coverage, but daily operator path needs tighter prioritization and fewer competing modules.",
    technicalDiagnosis:
      "Core architecture is modular and extensible; current bottleneck is orchestration clarity, state consolidation, and endpoint sprawl.",
    tradingReadinessDiagnosis: monitorConnected
      ? "Testnet execution path is connected with risk gates intact; continue paper/testnet-first validation."
      : "Trading loop blocked by monitor/connectivity gap; resolve telemetry and execution feedback before adding scope.",
    uxDiagnosis:
      "Cockpit and advanced modules are both visible; simplify primary workflow and progressively disclose advanced tooling.",
    automationDiagnosis: automationHasRun
      ? "Automation pipeline is enabled; focus next on quality of generated actions and signal-to-noise."
      : "Automation exists but lacks trusted recent runs; stabilize cron evidence and action queue hygiene.",
    topProblems,
    hiddenRisks,
  };
}
