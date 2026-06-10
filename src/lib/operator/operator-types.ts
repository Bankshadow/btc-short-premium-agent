export type RiskMode = "CONSERVATIVE" | "NORMAL" | "AGGRESSIVE";
export type EngineRunState = "RUNNING" | "PAUSED";

export interface ManualNote {
  noteId: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

export interface OperatorStatus {
  killSwitchActive: boolean;
  killSwitchReason: string | null;
  riskMode: RiskMode;
  engineState: EngineRunState;
  pendingApprovals: Array<{ improvementId: string; title: string; type: string }>;
  allowedSymbols: string[];
  maxNotionalUsd: number;
  latestManualNotes: ManualNote[];
  liveLocked: true;
  checkedAt: string;
}

export interface OperatorActionResult {
  ok: boolean;
  message: string;
  status?: Partial<OperatorStatus>;
}
