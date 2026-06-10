/** MVP 86 — advanced module consolidation metadata. */
export const ADVANCED_MODULES_MVP = 86 as const;
export const ADVANCED_MODULES_LABEL = "Advanced Module Consolidation";

export type AdvancedModuleId =
  | "strategy-registry"
  | "governance"
  | "validation"
  | "council"
  | "simulation"
  | "war-room"
  | "incidents"
  | "capital"
  | "automation"
  | "api-docs"
  | "ledger"
  | "debug";

export type AdvancedModuleRole = "analysis_input" | "advisory" | "metadata";

export interface AdvancedModuleDefinition {
  id: AdvancedModuleId;
  label: string;
  href: string;
  description: string;
  role: AdvancedModuleRole;
  /** Central engine reads this module when building AnalysisContext. */
  engineReads: boolean;
  /** Field on AnalysisContext when engineReads is true. */
  contextField: string | null;
  relatedEventTypes: string[];
}

export interface AdvancedModuleStatus {
  id: AdvancedModuleId;
  label: string;
  href: string;
  description: string;
  role: AdvancedModuleRole;
  engineReads: boolean;
  contextField: string | null;
  advisoryOnly: boolean;
  lastUpdatedAt: string | null;
  analysisImpact: string | null;
  relatedEvents: Array<{
    id: string;
    type: string;
    summary: string;
    timestamp: string;
  }>;
  usedByCentralEngine: boolean;
}

export interface AdvancedModulesSnapshot {
  mvp: typeof ADVANCED_MODULES_MVP;
  label: typeof ADVANCED_MODULES_LABEL;
  modules: AdvancedModuleStatus[];
  generatedAt: string;
}
