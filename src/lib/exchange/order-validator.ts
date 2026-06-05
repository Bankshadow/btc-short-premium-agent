import { SUPPORTED_PERP_ASSETS } from "@/lib/multi-asset/asset-config";
import type { LinearInstrumentInfo } from "./instrument-info";

const DEFAULT_MAX_NOTIONAL = Number(
  process.env.LIVE_MAX_NOTIONAL_USD?.trim() || "500",
);

function parseAllowedSymbols(): Set<string> | null {
  const raw = process.env.LIVE_ALLOWED_SYMBOLS?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

const SUPPORTED_LINEAR = new Set(
  SUPPORTED_PERP_ASSETS.map((a) => a.symbol.toUpperCase()),
);

export function validateLinearOrder(input: {
  symbol: string;
  qty: number;
  price: number;
  notionalUsd: number;
  instrument: LinearInstrumentInfo;
  availableBalanceUsd: number | null;
}): { rejectReasons: string[]; warnings: string[] } {
  const rejectReasons: string[] = [];
  const warnings: string[] = [];

  const symbol = input.symbol.toUpperCase();
  const allowed = parseAllowedSymbols();

  if (!SUPPORTED_LINEAR.has(symbol)) {
    rejectReasons.push(`Symbol ${symbol} is not in the desk supported perp list.`);
  }
  if (allowed && !allowed.has(symbol)) {
    rejectReasons.push(
      `Symbol ${symbol} is not in LIVE_ALLOWED_SYMBOLS (${[...allowed].join(", ")}).`,
    );
  }

  if (input.qty < input.instrument.minOrderQty) {
    rejectReasons.push(
      `Qty ${input.qty} below min ${input.instrument.minOrderQty} for ${symbol}.`,
    );
  }
  if (input.qty > input.instrument.maxOrderQty) {
    rejectReasons.push(
      `Qty ${input.qty} exceeds max ${input.instrument.maxOrderQty}.`,
    );
  }

  const notional = input.qty * input.price;
  if (notional < input.instrument.minNotionalValue) {
    rejectReasons.push(
      `Notional $${notional.toFixed(2)} below min $${input.instrument.minNotionalValue}.`,
    );
  }
  if (input.notionalUsd > DEFAULT_MAX_NOTIONAL) {
    rejectReasons.push(
      `Requested notional $${input.notionalUsd.toFixed(2)} exceeds LIVE_MAX_NOTIONAL_USD ($${DEFAULT_MAX_NOTIONAL}).`,
    );
  }

  if (input.availableBalanceUsd !== null) {
    if (input.notionalUsd > input.availableBalanceUsd) {
      rejectReasons.push(
        `Insufficient balance: need ~$${input.notionalUsd.toFixed(2)}, available $${input.availableBalanceUsd.toFixed(2)}.`,
      );
    } else if (input.notionalUsd > input.availableBalanceUsd * 0.5) {
      warnings.push(
        "Notional exceeds 50% of available balance — high margin usage.",
      );
    }
  } else {
    warnings.push(
      "Wallet balance unavailable — margin check skipped (configure BYBIT_API_KEY).",
    );
  }

  if (process.env.LIVE_EXECUTION_ENABLED?.trim().toLowerCase() === "true") {
    warnings.push("LIVE_EXECUTION_ENABLED is on — preview only, no order sent.");
  }

  return { rejectReasons, warnings };
}

export function validateOptionOrder(input: {
  symbol: string;
  qty: number;
  price: number;
  notionalUsd: number;
  availableBalanceUsd: number | null;
}): { rejectReasons: string[]; warnings: string[] } {
  const rejectReasons: string[] = [];
  const warnings: string[] = [];

  if (!input.symbol || !/-[CP]$/i.test(input.symbol)) {
    rejectReasons.push(
      "Option symbol missing or invalid — expected Bybit option format (e.g. BTC-29MAR26-65000-C).",
    );
  }
  if (input.qty < 1) {
    rejectReasons.push("Option contract qty must be at least 1.");
  }
  if (input.price <= 0) {
    rejectReasons.push("Limit price must be positive.");
  }
  if (input.notionalUsd > DEFAULT_MAX_NOTIONAL) {
    rejectReasons.push(
      `Premium exposure $${input.notionalUsd.toFixed(2)} exceeds LIVE_MAX_NOTIONAL_USD ($${DEFAULT_MAX_NOTIONAL}).`,
    );
  }
  if (input.availableBalanceUsd !== null && input.notionalUsd > input.availableBalanceUsd) {
    rejectReasons.push("Insufficient USDT for option margin/premium.");
  } else if (input.availableBalanceUsd === null) {
    warnings.push("Wallet balance unavailable — margin check skipped.");
  }

  warnings.push("Options preview is advisory — verify margin mode on Bybit before live.");
  return { rejectReasons, warnings };
}

export function estimateTakerFeeUsd(notionalUsd: number): number {
  return Number((notionalUsd * 0.00055).toFixed(4));
}
