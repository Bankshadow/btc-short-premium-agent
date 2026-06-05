import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { LinearInstrumentInfo } from "./instrument-info";

export interface MappedLinearOrder {
  category: "linear";
  symbol: string;
  side: "Buy" | "Sell";
  orderType: "Market";
  qty: string;
  timeInForce: "IOC";
  reduceOnly: boolean;
  stopLoss?: string;
  takeProfit?: string;
}

export interface MappedOptionOrder {
  category: "option";
  symbol: string;
  side: "Sell";
  orderType: "Limit";
  qty: string;
  price: string;
  timeInForce: "GTC";
  reduceOnly: boolean;
}

export function roundQtyToStep(qty: number, step: number): number {
  if (step <= 0 || qty <= 0) return 0;
  const rounded = Math.floor(qty / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(rounded.toFixed(decimals));
}

export function computeLinearQty(
  notionalUsd: number,
  price: number,
  instrument: LinearInstrumentInfo,
): number {
  if (price <= 0 || notionalUsd <= 0) return 0;
  const raw = notionalUsd / price;
  return roundQtyToStep(raw, instrument.qtyStep);
}

export function mapPerpSignalToLinearOrder(
  signal: PerpDirectionalSignal,
  notionalUsd: number,
  instrument: LinearInstrumentInfo,
): MappedLinearOrder | null {
  if (signal.direction === "FLAT" || signal.price <= 0) return null;

  const qty = computeLinearQty(notionalUsd, signal.price, instrument);
  if (qty <= 0) return null;

  const order: MappedLinearOrder = {
    category: "linear",
    symbol: signal.symbol,
    side: signal.direction === "LONG" ? "Buy" : "Sell",
    orderType: "Market",
    qty: String(qty),
    timeInForce: "IOC",
    reduceOnly: false,
  };

  if (signal.stopLoss != null && signal.stopLoss > 0) {
    order.stopLoss = String(signal.stopLoss);
  }
  if (signal.takeProfit != null && signal.takeProfit > 0) {
    order.takeProfit = String(signal.takeProfit);
  }

  return order;
}

/** BTC options short premium — limit sell at mark. */
export function mapOrderTicketToOptionOrder(
  ticket: OrderTicket,
  notionalUsd: number,
): MappedOptionOrder | null {
  if (
    ticket.instrument !== "sell_call" &&
    ticket.instrument !== "sell_put"
  ) {
    return null;
  }
  if (!ticket.symbol || ticket.entryOptionMark == null || ticket.entryOptionMark <= 0) {
    return null;
  }

  const contractValue = ticket.entryOptionMark;
  const contracts = Math.max(1, Math.floor(notionalUsd / contractValue));

  return {
    category: "option",
    symbol: ticket.symbol,
    side: "Sell",
    orderType: "Limit",
    qty: String(contracts),
    price: String(ticket.entryOptionMark),
    timeInForce: "GTC",
    reduceOnly: false,
  };
}

export function resolvePreviewNotionalUsd(
  sizePct: number,
  equityUsd: number,
  fallbackEquityUsd = 10_000,
): number {
  const equity = equityUsd > 0 ? equityUsd : fallbackEquityUsd;
  const pct = sizePct > 0 ? sizePct : 1;
  return Number((equity * (pct / 100)).toFixed(2));
}
