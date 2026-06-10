export interface LiveSandboxStatus {
  liveLocked: true;
  liveEnvPresent: boolean;
  liveEnvDisabledByPolicy: boolean;
  policyLocked: true;
  lastPreflightAt: string | null;
  lastDryRunAt: string | null;
  blockers: string[];
  message: string;
}

export interface LivePreflightResult {
  ok: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  blockers: string[];
  liveLocked: true;
}

export interface LiveDryRunResult {
  ok: boolean;
  dryRunId: string;
  simulatedOrder: null;
  blockers: string[];
  message: string;
  liveLocked: true;
}
