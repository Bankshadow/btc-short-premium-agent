import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import { EXCHANGE_ENV_HINT, resolveExchangeCredentials } from "./exchange-config";
import { fetchLinearInstrumentInfo } from "./instrument-info";
import {
  mapOrderTicketToOptionOrder,
  mapPerpSignalToLinearOrder,
  resolvePreviewNotionalUsd,
} from "./instrument-mapper";
import {
  estimateTakerFeeUsd,
  validateLinearOrder,
  validateOptionOrder,
} from "./order-validator";
import { attachExecuteConfirmToken } from "./execute-confirm";
import type { OrderPreviewResult } from "./types";
import { fetchWalletSnapshot } from "./wallet";

const DISCLAIMER =
  "Order preview (MVP 33/34). No order placed until execute with confirm token + LIVE_EXECUTION_ENABLED.";

function unavailablePreview(
  source: OrderPreviewResult["source"],
  reason: string,
): OrderPreviewResult {
  return {
    valid: false,
    source,
    category: "linear",
    symbol: "",
    side: "",
    rejectReasons: [reason],
    warnings: [],
    estNotionalUsd: 0,
    estQty: 0,
    estFeeUsd: 0,
    availableBalanceUsd: null,
    marginSufficient: null,
    bybitPayload: {},
    slTpPlan: { stopLoss: null, takeProfit: null },
    configured: false,
    network: null,
    executeConfirmToken: null,
    executeConfirmExpiresAt: null,
    disclaimer: DISCLAIMER,
  };
}

async function resolveAvailableUsdt(): Promise<number | null> {
  const creds = resolveExchangeCredentials();
  if (!creds) return null;
  try {
    const wallet = await fetchWalletSnapshot(creds);
    const usdt = wallet?.coins.find((c) => c.coin === "USDT");
    return usdt?.availableBalance ?? wallet?.totalEquityUsd ?? null;
  } catch {
    return null;
  }
}

export async function previewPerpSignal(
  signal: PerpDirectionalSignal,
): Promise<OrderPreviewResult> {
  const creds = resolveExchangeCredentials();

  if (signal.direction === "FLAT" || !signal.actionable) {
    return unavailablePreview(
      "perp_signal",
      "Signal is not actionable (FLAT or below conviction threshold).",
    );
  }
  if (signal.price <= 0) {
    return unavailablePreview("perp_signal", "Invalid or missing price.");
  }

  const availableBalanceUsd = await resolveAvailableUsdt();
  const notionalUsd = resolvePreviewNotionalUsd(
    signal.suggestedSizePct,
    availableBalanceUsd ?? 0,
  );

  let instrument;
  try {
    instrument = await fetchLinearInstrumentInfo(signal.symbol);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instrument info fetch failed";
    return unavailablePreview("perp_signal", message);
  }

  const mapped = mapPerpSignalToLinearOrder(signal, notionalUsd, instrument);
  if (!mapped) {
    return unavailablePreview("perp_signal", "Could not map signal to linear order.");
  }

  const qty = Number(mapped.qty);
  const { rejectReasons, warnings } = validateLinearOrder({
    symbol: signal.symbol,
    qty,
    price: signal.price,
    notionalUsd,
    instrument,
    availableBalanceUsd,
  });

  const estNotionalUsd = Number((qty * signal.price).toFixed(2));

  return attachExecuteConfirmToken({
    valid: rejectReasons.length === 0,
    source: "perp_signal",
    category: "linear",
    symbol: signal.symbol,
    side: mapped.side,
    rejectReasons,
    warnings,
    estNotionalUsd,
    estQty: qty,
    estFeeUsd: estimateTakerFeeUsd(estNotionalUsd),
    availableBalanceUsd,
    marginSufficient:
      availableBalanceUsd === null
        ? null
        : estNotionalUsd <= availableBalanceUsd,
    bybitPayload: mapped as unknown as Record<string, unknown>,
    slTpPlan: {
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
    },
    configured: creds !== null,
    network: creds?.network ?? null,
    executeConfirmToken: null,
    executeConfirmExpiresAt: null,
    disclaimer: DISCLAIMER,
  });
}

export async function previewOrderTicket(
  ticket: OrderTicket,
): Promise<OrderPreviewResult> {
  const creds = resolveExchangeCredentials();
  const availableBalanceUsd = await resolveAvailableUsdt();
  const notionalUsd = resolvePreviewNotionalUsd(
    ticket.positionSizePct,
    availableBalanceUsd ?? 0,
  );

  const mapped = mapOrderTicketToOptionOrder(ticket, notionalUsd);
  if (!mapped) {
    return {
      valid: false,
      source: "order_ticket",
      category: "linear",
      symbol: ticket.symbol,
      side: ticket.side,
      rejectReasons: [
        "Only BTC option sell_call / sell_put tickets can be previewed in MVP 33.",
        "Perp tickets: use /assets scanner preview.",
      ],
      warnings: creds ? [] : [EXCHANGE_ENV_HINT],
      estNotionalUsd: 0,
      estQty: 0,
      estFeeUsd: 0,
      availableBalanceUsd,
      marginSufficient: null,
      bybitPayload: {},
      slTpPlan: {
        stopLoss: ticket.stopLoss,
        takeProfit: ticket.takeProfit,
      },
      configured: creds !== null,
      network: creds?.network ?? null,
      executeConfirmToken: null,
      executeConfirmExpiresAt: null,
      disclaimer: DISCLAIMER,
    };
  }

  const qty = Number(mapped.qty);
  const price = Number(mapped.price);
  const { rejectReasons, warnings } = validateOptionOrder({
    symbol: mapped.symbol,
    qty,
    price,
    notionalUsd: qty * price,
    availableBalanceUsd,
  });

  const estNotionalUsd = Number((qty * price).toFixed(2));

  return attachExecuteConfirmToken({
    valid: rejectReasons.length === 0,
    source: "order_ticket",
    category: "option",
    symbol: mapped.symbol,
    side: mapped.side,
    rejectReasons,
    warnings,
    estNotionalUsd,
    estQty: qty,
    estFeeUsd: estimateTakerFeeUsd(estNotionalUsd),
    availableBalanceUsd,
    marginSufficient:
      availableBalanceUsd === null
        ? null
        : estNotionalUsd <= availableBalanceUsd,
    bybitPayload: mapped as unknown as Record<string, unknown>,
    slTpPlan: {
      stopLoss: ticket.stopLoss,
      takeProfit: ticket.takeProfit,
    },
    configured: creds !== null,
    network: creds?.network ?? null,
    executeConfirmToken: null,
    executeConfirmExpiresAt: null,
    disclaimer: DISCLAIMER,
  });
}
