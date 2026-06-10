export interface RiskPolicy {
  liveLocked: true;
  testnetOnly: true;
  requireDoubleConfirm: true;
}

export interface ExecuteGateInput {
  decisionLogId?: string | null;
  previewId?: string | null;
  doubleConfirm?: boolean;
}

export interface PreviewCreationGateInput {
  runId?: string | null;
  decisionLogId?: string | null;
  symbol?: string | null;
  side?: "BUY" | "SELL" | null;
  notionalUsd?: number | null;
  environment?: "TESTNET" | "LIVE" | string | null;
}

export interface RiskGateResult {
  allowed: boolean;
  blockReasons: string[];
  policy: RiskPolicy;
}
