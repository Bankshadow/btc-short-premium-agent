export type EngineHealthStatus = "OK" | "WARNING" | "BLOCKED";

export interface EngineHealthIssue {
  code: string;
  severity: "WARNING" | "BLOCKED";
  message: string;
}

export interface EngineHealthReport {
  status: EngineHealthStatus;
  checkedAt: string;
  issues: EngineHealthIssue[];
  orphanTrades: string[];
  missingPnlTrades: string[];
  stalePositionTrades: string[];
  message: string;
  blocksExecution: boolean;
}
