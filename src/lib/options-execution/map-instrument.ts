import { parseOptionSymbol } from "@/lib/bybit/option-chain";
import type { OptionCandidate } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { OptionsInstrument } from "./types";
import { OPTIONS_EXECUTION_DEFAULTS } from "./config";

export interface MapInstrumentResult {
  instrument: OptionsInstrument | null;
  errors: string[];
}

function expectedOptionType(
  action: OrderTicket["instrument"],
): "call" | "put" | null {
  if (action === "sell_call") return "call";
  if (action === "sell_put") return "put";
  return null;
}

export function mapPlaybookToOptionsInstrument(
  ticket: OrderTicket,
  candidate?: OptionCandidate | null,
): MapInstrumentResult {
  const errors: string[] = [];
  const symbol = candidate?.symbol ?? ticket.symbol;

  const parsed = parseOptionSymbol(symbol);
  if (!parsed) {
    errors.push(`Cannot parse Bybit option symbol: ${symbol}`);
    return { instrument: null, errors };
  }

  const expected = expectedOptionType(ticket.instrument);
  const optionType = parsed.side === "CALL" ? "call" : "put";
  if (expected && optionType !== expected) {
    errors.push(
      `Instrument type mismatch: ticket ${ticket.instrument} expects ${expected}, symbol is ${optionType}.`,
    );
  }

  if (ticket.strike != null && Math.abs(ticket.strike - parsed.strike) > 0.01) {
    errors.push(
      `Strike mismatch: ticket ${ticket.strike} vs symbol ${parsed.strike}.`,
    );
  }

  const bid = candidate?.bid ?? 0;
  const ask = candidate?.ask ?? 0;
  const mark = candidate?.markPrice ?? ticket.entryOptionMark ?? 0;

  if (bid <= 0 || ask <= 0) {
    errors.push("Invalid bid/ask — illiquid or missing quotes.");
  }
  if (mark <= 0) {
    errors.push("Invalid mark price.");
  }

  const spreadPct =
    mark > 0 ? Number((((ask - bid) / mark) * 100).toFixed(2)) : 100;
  if (spreadPct > OPTIONS_EXECUTION_DEFAULTS.minBidAskSpreadPct) {
    errors.push(`Wide spread ${spreadPct}% — liquidity risk.`);
  }

  const now = Date.now();
  if (parsed.expiryTime <= now) {
    errors.push("Option already expired.");
  }

  const hoursToExpiry = (parsed.expiryTime - now) / (60 * 60 * 1000);
  if (hoursToExpiry < OPTIONS_EXECUTION_DEFAULTS.minHoursToExpiry) {
    errors.push(
      `Expiry too close (${hoursToExpiry.toFixed(1)}h) — min ${OPTIONS_EXECUTION_DEFAULTS.minHoursToExpiry}h.`,
    );
  }

  const instrument: OptionsInstrument = {
    symbol: parsed.base + "-" + parsed.expiryCode + "-" + parsed.strike + "-" + (parsed.side === "CALL" ? "C" : "P"),
    base: parsed.base,
    strike: parsed.strike,
    expiry: parsed.expiry,
    expiryTimeMs: parsed.expiryTime,
    optionType,
    bid,
    ask,
    markPrice: mark,
    spreadPct,
    delta: candidate?.delta ?? 0,
    iv: candidate?.impliedVolatility ?? 0,
    mapped: errors.length === 0,
    mappingErrors: errors,
  };

  instrument.symbol = symbol;

  instrument.mapped = errors.length === 0;
  instrument.mappingErrors = errors;

  return { instrument, errors };
}
