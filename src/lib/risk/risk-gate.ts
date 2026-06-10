import type {
  ExecuteGateInput,
  PreviewCreationGateInput,
  RiskGateResult,
  RiskPolicy,
} from "./risk-types";

export const RISK_POLICY: RiskPolicy = {
  liveLocked: true,
  testnetOnly: true,
  requireDoubleConfirm: true,
};

export function isTestnetConfigured(): boolean {
  const enabled = process.env.BINANCE_TESTNET_ENABLED?.trim().toLowerCase();
  return enabled === "true" || enabled === "1" || enabled === "yes";
}

export function isLiveEnabled(): boolean {
  const raw =
    process.env.BINANCE_LIVE_ENABLED?.trim().toLowerCase() ||
    process.env.LIVE_EXECUTION_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function maxPreviewNotionalUsd(): number {
  const raw = process.env.BINANCE_TESTNET_MAX_NOTIONAL_USD?.trim();
  const n = raw ? Number(raw) : 50;
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function allowedPreviewSymbols(): string[] {
  const raw = process.env.BINANCE_ALLOWED_SYMBOLS?.trim();
  if (!raw) return ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

export function evaluatePreviewCreationGate(
  input: PreviewCreationGateInput,
): RiskGateResult {
  const blockReasons: string[] = [];

  if (isLiveEnabled()) {
    blockReasons.push("Live trading is locked — live environment not allowed.");
  }

  if (input.environment && input.environment !== "TESTNET") {
    blockReasons.push("Only TESTNET preview environment is allowed in v2-core.");
  }

  if (!isTestnetConfigured()) {
    blockReasons.push("Testnet not configured — set BINANCE_TESTNET_ENABLED=true.");
  }

  if (!input.runId) {
    blockReasons.push("Missing runId.");
  }

  if (!input.decisionLogId) {
    blockReasons.push("Missing decisionLogId.");
  }

  const symbol = input.symbol?.toUpperCase() ?? "";
  if (!symbol) {
    blockReasons.push("Invalid symbol.");
  } else if (!allowedPreviewSymbols().includes(symbol)) {
    blockReasons.push(`${symbol} is not in the preview allowlist.`);
  }

  if (input.side !== "BUY" && input.side !== "SELL") {
    blockReasons.push("Invalid side — must be BUY or SELL.");
  }

  const notional = input.notionalUsd ?? 0;
  if (!Number.isFinite(notional) || notional <= 0) {
    blockReasons.push("Invalid notionalUsd.");
  } else if (notional > maxPreviewNotionalUsd()) {
    blockReasons.push(
      `Notional $${notional} exceeds testnet preview limit $${maxPreviewNotionalUsd()}.`,
    );
  }

  return {
    allowed: blockReasons.length === 0,
    blockReasons,
    policy: RISK_POLICY,
  };
}

export function evaluateExecuteGate(input: ExecuteGateInput): RiskGateResult {
  const blockReasons: string[] = [];

  blockReasons.push("Live trading is locked — testnet execute only when live flags are false.");

  if (!input.decisionLogId) {
    blockReasons.push("Missing decisionLogId — preview not linked to analysis.");
  }

  if (!input.previewId) {
    blockReasons.push("Missing previewId.");
  }

  if (RISK_POLICY.requireDoubleConfirm && !input.doubleConfirm) {
    blockReasons.push("Double confirmation required.");
  }

  return {
    allowed: blockReasons.length === 0,
    blockReasons,
    policy: RISK_POLICY,
  };
}
