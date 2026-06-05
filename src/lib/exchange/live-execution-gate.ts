import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import { checkTradeFrequency } from "@/lib/frequency/trade-frequency-governor";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { ExchangeApiError } from "./bybit-auth-client";
import { verifyExecuteConfirmToken } from "./execute-confirm";
import { resolveExchangeCredentials } from "./exchange-config";
import type { MappedLinearOrder } from "./instrument-mapper";
import { placeLinearMarketOrder } from "./place-linear-order";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { previewPerpSignal } from "./order-preview";
import type { LiveExecuteResult, OrderPreviewResult } from "./types";

function liveEnabled(): boolean {
  const raw = process.env.LIVE_EXECUTION_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function requireDoubleConfirm(): boolean {
  const raw = process.env.LIVE_REQUIRE_DOUBLE_CONFIRM?.trim().toLowerCase();
  return raw !== "false";
}

export interface LiveExecuteInput {
  signal: PerpDirectionalSignal;
  confirmToken: string;
  confirmExpiresAt: string;
  doubleConfirm: boolean;
  operatorNote?: string;
  entries?: DecisionLogEntry[];
}

export async function executeLivePerpOrder(
  input: LiveExecuteInput,
): Promise<LiveExecuteResult> {
  const auditId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const note = input.operatorNote?.trim() ?? "";

  if (!liveEnabled()) {
    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: null,
      testnet: false,
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: "LIVE_EXECUTION_ENABLED is not true — live orders blocked.",
    };
  }

  const creds = resolveExchangeCredentials();
  if (!creds) {
    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: null,
      testnet: false,
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: "Exchange credentials not configured.",
    };
  }

  if (requireDoubleConfirm() && !input.doubleConfirm) {
    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: "doubleConfirm must be true for live execution.",
    };
  }

  const riskReport = evaluateRealTimeRisk({
    entries: input.entries ?? [],
    orders: [],
  });
  if (riskReport.blockNewTrades) {
    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: `Real-time risk ${riskReport.riskStatus} — new trades blocked.`,
    };
  }

  const frequency = checkTradeFrequency({ entries: input.entries ?? [] });
  if (!frequency.frequencyAllowed) {
    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: frequency.reason ?? "Trade frequency governor blocked live order.",
    };
  }

  const preview = await previewPerpSignal(input.signal);
  if (!preview.valid) {
    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: `Preview invalid: ${preview.rejectReasons.join("; ")}`,
    };
  }

  if (
    !verifyExecuteConfirmToken({
      preview,
      token: input.confirmToken,
      expiresAt: input.confirmExpiresAt,
    })
  ) {
    return {
      ok: false,
      orderId: null,
      symbol: preview.symbol,
      side: preview.side,
      qty: preview.estQty,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: "Invalid or expired execute confirm token — re-run preview.",
    };
  }

  try {
    const placed = await placeLinearMarketOrder(
      creds,
      preview.bybitPayload as unknown as MappedLinearOrder,
    );

    return {
      ok: true,
      orderId: placed.orderId,
      symbol: preview.symbol,
      side: preview.side,
      qty: preview.estQty,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
    };
  } catch (error) {
    const retCode =
      error instanceof ExchangeApiError ? error.retCode : undefined;
    return {
      ok: false,
      orderId: null,
      symbol: preview.symbol,
      side: preview.side,
      qty: preview.estQty,
      network: creds.network,
      testnet: creds.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId,
      error: error instanceof Error ? error.message : "Live order failed",
      retCode,
    };
  }
}

export function liveExecutionStatus(): {
  enabled: boolean;
  configured: boolean;
  network: string | null;
  requireDoubleConfirm: boolean;
} {
  const creds = resolveExchangeCredentials();
  return {
    enabled: liveEnabled(),
    configured: creds !== null,
    network: creds?.network ?? null,
    requireDoubleConfirm: requireDoubleConfirm(),
  };
}
