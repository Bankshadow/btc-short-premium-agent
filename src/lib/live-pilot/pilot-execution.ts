import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import { ExchangeApiError } from "@/lib/exchange/bybit-auth-client";
import { verifyExecuteConfirmToken } from "@/lib/exchange/execute-confirm";
import { resolveExchangeCredentials } from "@/lib/exchange/exchange-config";
import { fetchLinearInstrumentInfo } from "@/lib/exchange/instrument-info";
import { mapCloseLinearPosition } from "@/lib/exchange/instrument-mapper";
import { executeLivePerpOrder } from "@/lib/exchange/live-execution-gate";
import { placeLinearMarketOrder } from "@/lib/exchange/place-linear-order";
import { previewPerpSignal } from "@/lib/exchange/order-preview";
import { estimateTakerFeeUsd } from "@/lib/exchange/order-validator";
import type { LiveExecuteResult, OrderPreviewResult } from "@/lib/exchange/types";
import { loadLivePilotRiskConfig } from "./pilot-config";
import { checkPilotGuards } from "./pilot-guards";
import { confirmTokenId } from "./journal-store";
import { resolveLivePilotMode } from "./pilot-mode";
import type { LiveTradeJournalEntry } from "./types";

export interface PilotExecuteInput {
  signal: PerpDirectionalSignal;
  confirmToken: string;
  confirmExpiresAt: string;
  doubleConfirm: boolean;
  operatorApproval: boolean;
  operatorApprovalNote?: string;
  previewId: string;
  sourceSignalId?: string | null;
  decisionLogId?: string | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  journal?: LiveTradeJournalEntry[];
  readinessStatus?: "PASS" | "WARNING" | "FAIL";
  emergencyStopActive?: boolean;
  riskBudget?: import("@/lib/risk-budget-optimizer/types").RiskBudgetResult | null;
}

export interface PilotExecuteResult extends LiveExecuteResult {
  liveTradeId: string;
  journalEntry: LiveTradeJournalEntry | null;
  pilotBlockers?: string[];
}

function newLiveTradeId(): string {
  return `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function executePilotPerpOrder(
  input: PilotExecuteInput,
): Promise<PilotExecuteResult> {
  const config = loadLivePilotRiskConfig();
  const mode = resolveLivePilotMode(config);
  const liveTradeId = newLiveTradeId();
  const journal = input.journal ?? [];
  const note = input.operatorApprovalNote?.trim() ?? "";

  const preview = await previewPerpSignal(input.signal);
  const guards = checkPilotGuards({
    preview,
    journal,
    config,
    mode,
    entries: input.entries,
    orders: input.orders,
    governance: input.governance,
    incidents: input.incidents,
    readinessStatus: input.readinessStatus,
    emergencyStopActive: input.emergencyStopActive,
    operatorApproval: input.operatorApproval,
    doubleConfirm: input.doubleConfirm,
    riskBudget: input.riskBudget,
  });

  if (!guards.allowed) {
    const blockedEntry: LiveTradeJournalEntry = {
      liveTradeId,
      sourceSignalId: input.sourceSignalId ?? null,
      decisionLogId: input.decisionLogId ?? null,
      previewId: input.previewId,
      confirmTokenId: confirmTokenId(input.confirmToken),
      exchangeOrderId: null,
      status: "BLOCKED",
      symbol: input.signal.symbol,
      side: input.signal.direction,
      entry: null,
      exit: null,
      realizedPnl: null,
      fees: null,
      slippage: null,
      operatorApproval: input.operatorApproval,
      operatorApprovalNote: note || null,
      createdAt: new Date().toISOString(),
      executedAt: null,
      closedAt: null,
      error: guards.blockers.join("; "),
      pilotMode: mode,
    };

    return {
      ok: false,
      orderId: null,
      symbol: input.signal.symbol,
      side: input.signal.direction,
      qty: 0,
      network: config.network,
      testnet: config.network === "testnet",
      timestamp: new Date().toISOString(),
      operatorNote: note,
      auditId: liveTradeId,
      error: guards.blockers.join("; "),
      liveTradeId,
      journalEntry: blockedEntry,
      pilotBlockers: guards.blockers,
    };
  }

  const result = await executeLivePerpOrder({
    signal: input.signal,
    confirmToken: input.confirmToken,
    confirmExpiresAt: input.confirmExpiresAt,
    doubleConfirm: input.doubleConfirm,
    operatorNote: note || "Live pilot execute MVP 26",
    entries: input.entries,
  });

  const journalEntry: LiveTradeJournalEntry = {
    liveTradeId,
    sourceSignalId: input.sourceSignalId ?? null,
    decisionLogId: input.decisionLogId ?? null,
    previewId: input.previewId,
    confirmTokenId: confirmTokenId(input.confirmToken),
    exchangeOrderId: result.orderId,
    status: result.ok ? "OPEN" : "FAILED",
    symbol: result.symbol,
    side: result.side,
    entry: result.ok
      ? {
          price: input.signal.price,
          qty: result.qty,
          notionalUsd: preview.estNotionalUsd,
          side: result.side,
          symbol: result.symbol,
          timestamp: result.timestamp,
        }
      : null,
    exit: null,
    realizedPnl: null,
    fees: result.ok ? estimateTakerFeeUsd(preview.estNotionalUsd) : null,
    slippage: null,
    operatorApproval: input.operatorApproval,
    operatorApprovalNote: note || null,
    createdAt: new Date().toISOString(),
    executedAt: result.ok ? result.timestamp : null,
    closedAt: null,
    error: result.error ?? null,
    pilotMode: mode,
  };

  return {
    ...result,
    liveTradeId,
    journalEntry,
  };
}

export interface PilotCloseInput {
  liveTradeId: string;
  symbol: string;
  positionSide: "Buy" | "Sell";
  qty: number;
  exitPrice: number;
  journal?: LiveTradeJournalEntry[];
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  readinessStatus?: "PASS" | "WARNING" | "FAIL";
  emergencyStopActive?: boolean;
}

export interface PilotCloseResult {
  ok: boolean;
  liveTradeId: string;
  orderId: string | null;
  journalEntry: LiveTradeJournalEntry | null;
  error?: string;
}

export async function closePilotPerpPosition(
  input: PilotCloseInput,
): Promise<PilotCloseResult> {
  const config = loadLivePilotRiskConfig();
  const mode = resolveLivePilotMode(config);
  const journal = input.journal ?? [];
  const trade = journal.find((j) => j.liveTradeId === input.liveTradeId);

  const closePreview: OrderPreviewResult = {
    valid: true,
    source: "perp_signal",
    category: "linear",
    symbol: input.symbol,
    side: input.positionSide === "Buy" ? "Sell" : "Buy",
    rejectReasons: [],
    warnings: [],
    estNotionalUsd: input.qty * input.exitPrice,
    estQty: input.qty,
    estFeeUsd: estimateTakerFeeUsd(input.qty * input.exitPrice),
    availableBalanceUsd: null,
    marginSufficient: null,
    bybitPayload: {},
    slTpPlan: { stopLoss: null, takeProfit: null },
    configured: true,
    network: config.network,
    executeConfirmToken: null,
    executeConfirmExpiresAt: null,
    disclaimer: "Reduce-only close",
  };

  const guards = checkPilotGuards({
    preview: closePreview,
    journal,
    config,
    mode,
    entries: input.entries,
    orders: input.orders,
    governance: input.governance,
    incidents: input.incidents,
    readinessStatus: input.readinessStatus,
    emergencyStopActive: input.emergencyStopActive,
    isCloseOrder: true,
  });

  if (!guards.allowed) {
    return {
      ok: false,
      liveTradeId: input.liveTradeId,
      orderId: null,
      journalEntry: trade
        ? { ...trade, error: guards.blockers.join("; ") }
        : null,
      error: guards.blockers.join("; "),
    };
  }

  const creds = resolveExchangeCredentials();
  if (!creds) {
    return {
      ok: false,
      liveTradeId: input.liveTradeId,
      orderId: null,
      journalEntry: null,
      error: "Exchange credentials not configured.",
    };
  }

  try {
    const instrument = await fetchLinearInstrumentInfo(input.symbol);
    const mapped = mapCloseLinearPosition({
      symbol: input.symbol,
      positionSide: input.positionSide,
      qty: input.qty,
      instrument,
    });
    if (!mapped) {
      return {
        ok: false,
        liveTradeId: input.liveTradeId,
        orderId: null,
        journalEntry: null,
        error: "Invalid close qty.",
      };
    }

    const placed = await placeLinearMarketOrder(creds, mapped);
    const entryNotional = trade?.entry?.notionalUsd ?? 0;
    const exitNotional = input.qty * input.exitPrice;
    const fees =
      estimateTakerFeeUsd(entryNotional) + estimateTakerFeeUsd(exitNotional);
    const direction = trade?.entry?.side === "Buy" ? 1 : -1;
    const realizedPnl = Number(
      (direction * (exitNotional - entryNotional) - fees).toFixed(2),
    );

    const closedEntry: LiveTradeJournalEntry = {
      ...(trade ?? {
        liveTradeId: input.liveTradeId,
        sourceSignalId: null,
        decisionLogId: null,
        previewId: "",
        confirmTokenId: "",
        exchangeOrderId: null,
        status: "OPEN",
        symbol: input.symbol,
        side: input.positionSide,
        entry: null,
        exit: null,
        realizedPnl: null,
        fees: null,
        slippage: null,
        operatorApproval: true,
        operatorApprovalNote: null,
        createdAt: new Date().toISOString(),
        executedAt: null,
        closedAt: null,
        error: null,
        pilotMode: mode,
      }),
      status: "CLOSED",
      exit: {
        price: input.exitPrice,
        qty: input.qty,
        notionalUsd: exitNotional,
        side: mapped.side,
        timestamp: new Date().toISOString(),
        reduceOnly: true,
      },
      realizedPnl,
      fees,
      closedAt: new Date().toISOString(),
      error: null,
    };

    return {
      ok: true,
      liveTradeId: input.liveTradeId,
      orderId: placed.orderId,
      journalEntry: closedEntry,
    };
  } catch (error) {
    const retCode =
      error instanceof ExchangeApiError ? error.retCode : undefined;
    return {
      ok: false,
      liveTradeId: input.liveTradeId,
      orderId: null,
      journalEntry: null,
      error:
        (error instanceof Error ? error.message : "Close failed") +
        (retCode != null ? ` (${retCode})` : ""),
    };
  }
}

export function validatePilotPreview(
  preview: OrderPreviewResult,
  journal: LiveTradeJournalEntry[],
  options?: {
    entries?: DecisionLogEntry[];
    orders?: PaperOrder[];
    governance?: GovernanceDeskState;
    incidents?: DeskIncident[];
    readinessStatus?: "PASS" | "WARNING" | "FAIL";
    emergencyStopActive?: boolean;
    riskBudget?: import("@/lib/risk-budget-optimizer/types").RiskBudgetResult | null;
  },
) {
  const config = loadLivePilotRiskConfig();
  const mode = resolveLivePilotMode(config);
  return checkPilotGuards({
    preview,
    journal,
    config,
    mode,
    entries: options?.entries,
    orders: options?.orders,
    governance: options?.governance,
    incidents: options?.incidents,
    readinessStatus: options?.readinessStatus,
    emergencyStopActive: options?.emergencyStopActive,
    riskBudget: options?.riskBudget,
    operatorApproval: false,
    doubleConfirm: false,
  });
}

export function verifyPilotConfirmToken(input: {
  preview: OrderPreviewResult;
  token: string;
  expiresAt: string;
}): boolean {
  return verifyExecuteConfirmToken(input);
}
