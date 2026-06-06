import type { StrategistAgentInput } from "./types";

export interface UxStrategistResult {
  uxDiagnosis: string;
  topUxProblems: string[];
  simplifyRecommendations: string[];
}

export function runUxStrategistAgent(input: StrategistAgentInput): UxStrategistResult {
  const routes = input.context.routeList;
  const topUxProblems: string[] = [];
  const simplifyRecommendations: string[] = [];

  const advancedRoutes = routes.filter(
    (r) =>
      r.startsWith("/war-room") ||
      r.startsWith("/simulation") ||
      r.startsWith("/experiments") ||
      r.startsWith("/rule-discovery") ||
      r.startsWith("/memory-graph"),
  ).length;
  const executionRoutes = routes.filter(
    (r) =>
      r.startsWith("/binance-testnet") ||
      r.startsWith("/testnet-monitor") ||
      r.startsWith("/options-testnet"),
  ).length;

  if (routes.length > 45) {
    topUxProblems.push("Primary cockpit competes with too many advanced modules.");
    simplifyRecommendations.push("Introduce clear Primary vs Advanced navigation groups.");
  }
  if (advancedRoutes >= executionRoutes) {
    topUxProblems.push("Advanced analytics are as prominent as execution-readiness flows.");
    simplifyRecommendations.push(
      "Promote testnet monitor + execution path above experimental modules.",
    );
  }
  if (!routes.includes("/project-strategist")) {
    topUxProblems.push("Strategic prioritization has no dedicated operator surface yet.");
    simplifyRecommendations.push("Add /project-strategist as an operator planning home.");
  }

  const uxDiagnosis =
    topUxProblems.length === 0
      ? "UX posture is healthy; continue incremental simplification and consistency checks."
      : `UX needs simplification in ${topUxProblems.length} area(s): ${topUxProblems.join(" ")}`;

  return { uxDiagnosis, topUxProblems, simplifyRecommendations };
}
