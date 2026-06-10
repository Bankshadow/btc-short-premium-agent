import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";
import type { EngineEvent } from "@/lib/engine-event-bus/types";
import type { AnalysisResult } from "@/lib/analysis-engine/analysis-result";
import {
  ADVANCED_MODULE_REGISTRY,
  getAdvancedModuleDefinition,
} from "./registry";
import type {
  AdvancedModuleId,
  AdvancedModuleStatus,
  AdvancedModulesSnapshot,
} from "./types";
import { ADVANCED_MODULES_LABEL, ADVANCED_MODULES_MVP } from "./types";

function impactForModule(
  def: (typeof ADVANCED_MODULE_REGISTRY)[number],
  context: AnalysisContext | null,
  latest: AnalysisResult | null,
): string | null {
  if (!context && !latest) return "No analysis context yet — run Start AI on Dashboard.";

  switch (def.id) {
    case "strategy-registry": {
      const disabled = context?.strategyRegistry?.strategies?.filter(
        (s) => s.status === "DISABLED" || s.status === "DEPRECATED",
      ).length;
      return disabled
        ? `${disabled} strateg(ies) disabled — may affect committee gates.`
        : `${context?.strategyRegistry?.strategies?.length ?? 0} strategies in analyze payload.`;
    }
    case "governance":
      if (context?.governance?.safeMode) return "Safe mode active — analysis constrained.";
      if (context?.governance?.pauseAnalysis) return "Governance paused analysis.";
      if (context?.governance?.hardRules?.locked) {
        return context.governance.hardRules.messages[0] ?? "Hard rule lock active.";
      }
      return "Governance clear — no hard blocks.";
    case "validation":
      if (context?.killSwitch.active) {
        return context.killSwitch.reason ?? "Kill switch active.";
      }
      if (context?.validation.blockers.length) {
        return context.validation.blockers[0];
      }
      return "Validation within limits.";
    case "council": {
      const v = latest?.finalVerdict ?? context?.councilState.weightedVerdict;
      return v
        ? `Committee verdict ${v} · ${context?.councilState.agentCount ?? 0} agents.`
        : "No committee verdict yet.";
    }
    case "simulation":
      return context?.simulationState.lastRunAt
        ? `Last automation/sim run ${new Date(context.simulationState.lastRunAt).toLocaleString()}.`
        : "No simulation/automation history — advisory only.";
    case "war-room":
      return "Advisory operator drills — does not feed AnalysisContext directly.";
    case "incidents":
      if (context?.incidentState.criticalOpen) {
        return `Critical incident open: ${context.incidentState.topTitle ?? "review required"}.`;
      }
      return context?.incidentState.openCount
        ? `${context.incidentState.openCount} open incident(s).`
        : "No open incidents.";
    case "capital":
      return context?.missionSnapshot
        ? `Mission ${context.missionSnapshot.progressPct}% · equity tracked in mission snapshot.`
        : "Advisory capital planning — mission snapshot optional.";
    case "automation":
      return context?.simulationState.lastRunAt
        ? `Last desk cycle ${new Date(context.simulationState.lastRunAt).toLocaleString()}.`
        : "Automation idle — Start AI or enable schedule on Settings.";
    case "api-docs":
      return "Metadata only — documents APIs consumed by UI and engine.";
    case "ledger":
      return `${context?.decisionLog.length ?? 0} decision log entries on server.`;
    case "debug":
      return context?.testnetStatus.connected
        ? "Testnet connected — execution readiness checks pass."
        : context?.testnetStatus.blocker ?? "Testnet not connected.";
    default:
      return null;
  }
}

function lastUpdatedForModule(
  def: (typeof ADVANCED_MODULE_REGISTRY)[number],
  context: AnalysisContext | null,
): string | null {
  if (!context) return null;
  switch (def.id) {
    case "strategy-registry":
    case "governance":
    case "validation":
    case "council":
    case "incidents":
    case "debug":
      return context.builtAt;
    case "simulation":
    case "automation":
      return context.simulationState.lastRunAt ?? context.builtAt;
    case "capital":
      return context.missionSnapshot?.lastUpdatedAt ?? context.builtAt;
    case "ledger":
      return context.decisionLog[0]?.timestamp ?? context.builtAt;
    default:
      return context.builtAt;
  }
}

function relatedEventsForModule(
  def: (typeof ADVANCED_MODULE_REGISTRY)[number],
  events: EngineEvent[],
  limit = 5,
): AdvancedModuleStatus["relatedEvents"] {
  const types = new Set(def.relatedEventTypes);
  return events
    .filter((e) => types.has(e.type))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      type: e.type,
      summary: e.summary,
      timestamp: e.timestamp,
    }));
}

export function buildAdvancedModuleStatus(input: {
  moduleId: AdvancedModuleId;
  context: AnalysisContext | null;
  latestResult: AnalysisResult | null;
  events: EngineEvent[];
}): AdvancedModuleStatus | null {
  const def = getAdvancedModuleDefinition(input.moduleId);
  if (!def) return null;

  return {
    id: def.id,
    label: def.label,
    href: def.href,
    description: def.description,
    role: def.role,
    engineReads: def.engineReads,
    contextField: def.contextField,
    advisoryOnly: def.role === "advisory" || def.role === "metadata",
    lastUpdatedAt: lastUpdatedForModule(def, input.context),
    analysisImpact: impactForModule(def, input.context, input.latestResult),
    relatedEvents: relatedEventsForModule(def, input.events),
    usedByCentralEngine: def.engineReads,
  };
}

export async function buildAdvancedModulesSnapshot(input: {
  context: AnalysisContext | null;
  latestResult: AnalysisResult | null;
  events: EngineEvent[];
}): Promise<AdvancedModulesSnapshot> {
  const modules = ADVANCED_MODULE_REGISTRY.map((def) =>
    buildAdvancedModuleStatus({
      moduleId: def.id,
      context: input.context,
      latestResult: input.latestResult,
      events: input.events,
    }),
  ).filter((m): m is AdvancedModuleStatus => m != null);

  return {
    mvp: ADVANCED_MODULES_MVP,
    label: ADVANCED_MODULES_LABEL,
    modules,
    generatedAt: new Date().toISOString(),
  };
}

/** Compact links stored on AnalysisContext for engine consumers. */
export function buildAdvancedModuleContextLinks(
  snapshot: AdvancedModulesSnapshot,
): AnalysisContext["advancedModules"] {
  return snapshot.modules.map((m) => ({
    id: m.id,
    label: m.label,
    engineReads: m.engineReads,
    advisoryOnly: m.advisoryOnly,
    contextField: m.contextField,
    lastUpdatedAt: m.lastUpdatedAt,
    analysisImpact: m.analysisImpact,
  }));
}
