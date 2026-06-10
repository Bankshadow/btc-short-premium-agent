export const ONE_BUTTON_AI_SAFETY_NOTICE =
  "One Button AI Mode chooses the next safe action only — testnet execute and close always require your double confirm. Live trading is never executed from this button.";

export type OneButtonAiLabel =
  | "Start AI"
  | "Run cycle now"
  | "Review preview"
  | "Approve testnet order"
  | "Monitor position"
  | "Close position"
  | "Generate report"
  | "Resolve blocker";

export type OneButtonAiAction =
  | "RUN_FIRST_ANALYSIS"
  | "RUN_ANALYSIS_CYCLE"
  | "CREATE_TESTNET_PREVIEW"
  | "ASK_PERMISSION_EXECUTE"
  | "MONITOR_POSITION"
  | "ASK_PERMISSION_CLOSE"
  | "REVIEW_TRADE"
  | "GENERATE_REPORT"
  | "PAUSE_IF_RISK"
  | "RESOLVE_ISSUE";

export interface OneButtonAiState {
  label: OneButtonAiLabel;
  action: OneButtonAiAction;
  reason: string;
  detail: string;
  requiresClientConfirm: boolean;
  confirmMode: "execute" | "close" | null;
  liveLocked: true;
  cannotAutoExecuteLive: true;
  safetyNotice: typeof ONE_BUTTON_AI_SAFETY_NOTICE;
}

export interface OneButtonAiStatus {
  generatedAt: string;
  state: OneButtonAiState;
  blockers: string[];
  safetyNotice: typeof ONE_BUTTON_AI_SAFETY_NOTICE;
}

export interface OneButtonAiRunResult {
  ok: boolean;
  action: OneButtonAiAction;
  label: OneButtonAiLabel;
  summary: string;
  requiresClientConfirm: boolean;
  confirmMode: "execute" | "close" | null;
  navigateTo: string | null;
  pausedAutomation?: boolean;
  previewId?: string | null;
  decisionLogId?: string | null;
  error?: string;
  safetyNotice: typeof ONE_BUTTON_AI_SAFETY_NOTICE;
  cannotAutoExecuteLive: true;
}
