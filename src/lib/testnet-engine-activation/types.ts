/** MVP 95 — Testnet + Engine Activation Fix Pack. */
export const TESTNET_ENGINE_ACTIVATION_MVP = 95 as const;
export const TESTNET_ENGINE_ACTIVATION_LABEL =
  "Testnet + Engine Activation Fix Pack";

export type BinanceTestnetDiagnosticStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "MISSING_ENV"
  | "PROXY_UNHEALTHY"
  | "BLOCKED_BY_REGION"
  | "AUTH_ERROR"
  | "API_ERROR"
  | "CLOCK_SKEW"
  | "UNKNOWN";

export interface BinanceTestnetDiagnosticSnapshot {
  mvp: typeof TESTNET_ENGINE_ACTIVATION_MVP;
  status: BinanceTestnetDiagnosticStatus;
  connected: boolean;
  testnetEnabled: boolean;
  liveEnabled: boolean;
  proxyEnabled: boolean;
  proxyProvider: string | null;
  proxyUrlConfigured: boolean;
  apiKeyPresent: boolean;
  apiSecretPresent: boolean;
  baseUrl: string;
  lastCheckedAt: string;
  reason: string;
  recommendation: string;
}

export type EngineActivationHealthStatus = "OK" | "WARNING" | "BLOCKED";

export interface EngineActivationHealthCheck {
  id: string;
  name: string;
  status: EngineActivationHealthStatus;
  reason: string;
  lastCheckedAt: string | null;
}

export interface EngineActivationHealthResponse {
  mvp: typeof TESTNET_ENGINE_ACTIVATION_MVP;
  status: EngineActivationHealthStatus;
  checks: EngineActivationHealthCheck[];
  blockers: string[];
  warnings: string[];
  updatedAt: string;
  liveTradingLocked: true;
}

export type ReconciliationActivationStatus = "OK" | "WARNING" | "BLOCKED";

export interface ReconciliationStatusResponse {
  mvp: typeof TESTNET_ENGINE_ACTIVATION_MVP;
  status: ReconciliationActivationStatus;
  message: string;
  orphanOpenTrades: number;
  closedTradeMissingPnl: number;
  decisionMissingJournal: number;
  journalMissingDecision: number;
  binancePositionMissingLocalTrade: number;
  localOpenTradeMissingBinancePosition: number;
  learningMissingForClosedTrade: number;
  autoFixAvailable: boolean;
  requiredManualAction: string | null;
  updatedAt: string;
  liveTradingLocked: true;
}

export type EvidenceQualityActivationStatus =
  | "OK"
  | "WARNING"
  | "INSUFFICIENT"
  | "BLOCKED";

export interface EvidenceQualityStatusResponse {
  mvp: typeof TESTNET_ENGINE_ACTIVATION_MVP;
  status: EvidenceQualityActivationStatus;
  validEvidenceCount: number;
  requiredEvidenceCount: number;
  invalidEvidenceCount: number;
  evidenceConfidence: number;
  missingFields: Array<{ field: string; count: number }>;
  message: string;
  updatedAt: string;
  liveTradingLocked: true;
}
