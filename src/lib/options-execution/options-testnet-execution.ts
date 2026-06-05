import { ExchangeApiError } from "@/lib/exchange/bybit-auth-client";
import { resolveExchangeCredentials } from "@/lib/exchange/exchange-config";
import {
  mapCloseOptionPosition,
  type MappedOptionOrder,
} from "@/lib/exchange/instrument-mapper";
import { placeOptionLimitOrder } from "@/lib/exchange/place-option-order";
import { fetchOpenOptionOrders } from "@/lib/exchange/open-orders";
import { fetchOptionPositions } from "@/lib/exchange/positions";
import type {
  ExchangeOpenOrderSnapshot,
  ExchangePositionSnapshot,
} from "@/lib/exchange/types";
import { newOptionsTestnetTradeId } from "./testnet-journal-store";
import { runOptionsRiskChecks, summarizeRiskChecks } from "./risk-checks";
import { assertOptionsTestnetExecutionAllowed } from "./testnet-gates";
import { reconcileOptionsTestnetState } from "./reconcile-testnet-state";
import type {
  OptionsOrderPreview,
  OptionsPreviewJournalEntry,
  OptionsTestnetClosePreview,
  OptionsTestnetJournalEntry,
} from "./types";

export { reconcileOptionsTestnetState };

export interface PlaceOptionsTestnetOrderInput {
  preview: OptionsOrderPreview;
  previewJournal?: OptionsPreviewJournalEntry[];
  operatorNote?: string;
  operatorApproval?: boolean;
}

export interface PlaceOptionsTestnetOrderResult {
  ok: boolean;
  testnetOnly: true;
  productionBlocked: true;
  optionsTestnetTradeId: string;
  exchangeOrderId: string | null;
  journalEntry: OptionsTestnetJournalEntry;
  error?: string;
  blockers?: string[];
}

export interface CloseOptionsTestnetOrderInput {
  closePreview: OptionsTestnetClosePreview;
  operatorApproval?: boolean;
  operatorNote?: string;
}

export interface CloseOptionsTestnetOrderResult {
  ok: boolean;
  testnetOnly: true;
  productionBlocked: true;
  exchangeOrderId: string | null;
  journalEntry: OptionsTestnetJournalEntry | null;
  error?: string;
  blockers?: string[];
}

function blockedJournalEntry(
  preview: OptionsOrderPreview,
  tradeId: string,
  blockers: string[],
): OptionsTestnetJournalEntry {
  return {
    optionsTestnetTradeId: tradeId,
    decisionLogId: preview.ticket?.decisionLogId ?? "",
    previewId: preview.previewId,
    instrument: preview.ticket?.instrument ?? "no_trade",
    side: preview.ticket?.side ?? "short",
    qty: preview.ticket?.contracts ?? 0,
    premium: preview.estimatedPremiumUsd,
    marginEstimateUsd: preview.margin.estimatedMarginUsd,
    status: "BLOCKED",
    exchangeOrderId: null,
    symbol: preview.ticket?.optionsInstrument.symbol ?? "",
    createdAt: new Date().toISOString(),
    executedAt: null,
    closedAt: null,
    operatorNote: null,
    error: blockers.join("; "),
  };
}

export async function placeOptionsTestnetOrder(
  input: PlaceOptionsTestnetOrderInput,
): Promise<PlaceOptionsTestnetOrderResult> {
  const tradeId = newOptionsTestnetTradeId();
  const gate = assertOptionsTestnetExecutionAllowed();

  if (!gate.allowed) {
    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      optionsTestnetTradeId: tradeId,
      exchangeOrderId: null,
      journalEntry: blockedJournalEntry(input.preview, tradeId, gate.blockers),
      error: gate.blockers.join("; "),
      blockers: gate.blockers,
    };
  }

  if (!input.operatorApproval) {
    const blockers = ["operatorApproval must be true for testnet execution."];
    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      optionsTestnetTradeId: tradeId,
      exchangeOrderId: null,
      journalEntry: blockedJournalEntry(input.preview, tradeId, blockers),
      error: blockers[0],
      blockers,
    };
  }

  const checks = runOptionsRiskChecks({
    ticket: input.preview.ticket,
    instrument: input.preview.ticket?.optionsInstrument ?? null,
    margin: input.preview.margin,
    journal: input.previewJournal ?? [],
  });
  const summary = summarizeRiskChecks(checks);

  if (!input.preview.valid || !summary.valid || !input.preview.bybitPayload) {
    const blockers =
      summary.blockingReasons.length > 0
        ? summary.blockingReasons
        : ["Preview invalid or missing Bybit payload."];
    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      optionsTestnetTradeId: tradeId,
      exchangeOrderId: null,
      journalEntry: blockedJournalEntry(input.preview, tradeId, blockers),
      error: blockers.join("; "),
      blockers,
    };
  }

  const creds = resolveExchangeCredentials()!;
  const payload = input.preview.bybitPayload as unknown as MappedOptionOrder;
  const note = input.operatorNote?.trim() ?? "";

  try {
    const placed = await placeOptionLimitOrder(creds, payload);
    const now = new Date().toISOString();
    const journalEntry: OptionsTestnetJournalEntry = {
      optionsTestnetTradeId: tradeId,
      decisionLogId: input.preview.ticket?.decisionLogId ?? "",
      previewId: input.preview.previewId,
      instrument: input.preview.ticket?.instrument ?? "no_trade",
      side: input.preview.ticket?.side ?? "short",
      qty: Number(payload.qty),
      premium: input.preview.estimatedPremiumUsd,
      marginEstimateUsd: input.preview.margin.estimatedMarginUsd,
      status: "SUBMITTED",
      exchangeOrderId: placed.orderId,
      symbol: payload.symbol,
      createdAt: now,
      executedAt: now,
      closedAt: null,
      operatorNote: note || `Testnet order ${placed.orderId}`,
      error: null,
    };

    return {
      ok: true,
      testnetOnly: true,
      productionBlocked: true,
      optionsTestnetTradeId: tradeId,
      exchangeOrderId: placed.orderId,
      journalEntry,
    };
  } catch (error) {
    const message =
      error instanceof ExchangeApiError
        ? `Bybit ${error.retCode ?? ""}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Testnet order failed";

    const journalEntry: OptionsTestnetJournalEntry = {
      ...blockedJournalEntry(input.preview, tradeId, [message]),
      status: "FAILED",
      error: message,
    };

    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      optionsTestnetTradeId: tradeId,
      exchangeOrderId: null,
      journalEntry,
      error: message,
    };
  }
}

export async function closeOptionsTestnetOrder(
  input: CloseOptionsTestnetOrderInput,
): Promise<CloseOptionsTestnetOrderResult> {
  const gate = assertOptionsTestnetExecutionAllowed();
  if (!gate.allowed) {
    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: gate.blockers.join("; "),
      blockers: gate.blockers,
    };
  }

  if (!input.operatorApproval) {
    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: "operatorApproval must be true for testnet close.",
      blockers: ["operatorApproval must be true for testnet close."],
    };
  }

  const mapped = mapCloseOptionPosition({
    symbol: input.closePreview.symbol,
    positionSide: input.closePreview.positionSide,
    qty: input.closePreview.qty,
    limitPrice: input.closePreview.estExitPrice,
  });

  if (!mapped) {
    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: "Invalid close preview — qty or price missing.",
    };
  }

  const creds = resolveExchangeCredentials()!;
  const note = input.operatorNote?.trim() ?? "";

  try {
    const placed = await placeOptionLimitOrder(creds, mapped);
    const now = new Date().toISOString();
    const journalEntry: OptionsTestnetJournalEntry = {
      optionsTestnetTradeId: input.closePreview.optionsTestnetTradeId,
      decisionLogId: "",
      previewId: input.closePreview.previewId,
      instrument: "no_trade",
      side: "long",
      qty: input.closePreview.qty,
      premium: input.closePreview.estPremiumUsd,
      marginEstimateUsd: 0,
      status: "CLOSING",
      exchangeOrderId: placed.orderId,
      symbol: input.closePreview.symbol,
      createdAt: now,
      executedAt: now,
      closedAt: null,
      operatorNote: note || `Testnet close ${placed.orderId}`,
      error: null,
    };

    return {
      ok: true,
      testnetOnly: true,
      productionBlocked: true,
      exchangeOrderId: placed.orderId,
      journalEntry,
    };
  } catch (error) {
    const message =
      error instanceof ExchangeApiError
        ? `Bybit ${error.retCode ?? ""}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Testnet close failed";

    return {
      ok: false,
      testnetOnly: true,
      productionBlocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: message,
    };
  }
}

export async function fetchOptionsTestnetPositions(): Promise<{
  ok: boolean;
  positions: ExchangePositionSnapshot[];
  error?: string;
  blockers?: string[];
}> {
  const gate = assertOptionsTestnetExecutionAllowed();
  if (!gate.allowed) {
    return { ok: false, positions: [], error: gate.blockers.join("; "), blockers: gate.blockers };
  }

  try {
    const creds = resolveExchangeCredentials()!;
    const positions = await fetchOptionPositions(creds);
    return { ok: true, positions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch positions failed";
    return { ok: false, positions: [], error: message };
  }
}

export async function fetchOptionsTestnetOrders(): Promise<{
  ok: boolean;
  orders: ExchangeOpenOrderSnapshot[];
  error?: string;
  blockers?: string[];
}> {
  const gate = assertOptionsTestnetExecutionAllowed();
  if (!gate.allowed) {
    return { ok: false, orders: [], error: gate.blockers.join("; "), blockers: gate.blockers };
  }

  try {
    const creds = resolveExchangeCredentials()!;
    const orders = await fetchOpenOptionOrders(creds);
    return { ok: true, orders };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch orders failed";
    return { ok: false, orders: [], error: message };
  }
}

