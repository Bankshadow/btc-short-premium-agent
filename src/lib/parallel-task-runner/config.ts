import type { ParallelAgentRole } from "./types";

export const PARALLEL_RUNNER_STORE_FILE = "parallel-task-runner.json";

export const PARALLEL_AGENT_ROLES: ParallelAgentRole[] = [
  "STRATEGY",
  "RISK",
  "UX",
  "EXECUTION",
  "LEARNING",
  "PROJECT_STRATEGIST",
];

export const PARALLEL_AGENT_LABELS: Record<ParallelAgentRole, string> = {
  STRATEGY: "Strategy Agent",
  RISK: "Risk Agent",
  UX: "UX Agent",
  EXECUTION: "Execution Agent",
  LEARNING: "Learning Agent",
  PROJECT_STRATEGIST: "Project Strategist",
};
