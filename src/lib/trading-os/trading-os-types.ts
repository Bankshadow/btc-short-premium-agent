import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";

export type DeskProfileId =
  | "btc_options_desk"
  | "crypto_multi_agent"
  | "paper_trading_lab"
  | "aggressive_growth_lab";

export type EnvironmentMode = "DEMO" | "PAPER" | "SEMI_LIVE" | "SAFE_MODE";

export type DeskViewMode = "public" | "private";

export interface DeskProfile {
  id: DeskProfileId;
  name: string;
  tagline: string;
  defaultRiskProfile: DeskRiskProfile;
  defaultEnvironmentMode: EnvironmentMode;
  symbolFocus: string;
  features: string[];
}

export interface ModeEffects {
  allowMockFallback: boolean;
  allowPaperAutoOpen: boolean;
  allowOrderTickets: boolean;
  requireHumanApproval: boolean;
  forceGovernanceSafeMode: boolean;
  allowLivePlaceholder: boolean;
  analysisOnlyLabel: string;
}

export interface WorkspaceConfig {
  activeProfileId: DeskProfileId;
  environmentMode: EnvironmentMode;
  viewMode: DeskViewMode;
  updatedAt: string;
}

export type ReportKind =
  | "daily_desk"
  | "weekly_performance"
  | "agent_scoreboard"
  | "risk_incidents";

export interface DeskReport {
  kind: ReportKind;
  title: string;
  generatedAt: string;
  format: "markdown" | "json";
  content: string;
}
