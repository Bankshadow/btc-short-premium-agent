import type { OptionTickerItem } from "./tickers";

export type OptionSide = "CALL" | "PUT";

export interface ParsedOptionSymbol {
  base: string;
  expiryCode: string;
  strike: number;
  side: OptionSide;
  expiry: string;
  expiryTime: number;
}

export interface ParsedOptionCandidate {
  symbol: string;
  side: OptionSide;
  strike: number;
  expiry: string;
  bid: number;
  ask: number;
  markPrice: number;
  delta: number;
  iv: number;
}

export interface OptionChainResult {
  expiry: string;
  expiryTime: number;
  calls: ParsedOptionCandidate[];
  puts: ParsedOptionCandidate[];
  /** Sweet-spot (0.13–0.15) or fallback (0.08–0.18), sorted by |delta| closest to 0.14 */
  candidates: ParsedOptionCandidate[];
}

const MONTHS: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const SYMBOL_PATTERN =
  /^([A-Z]+)-(\d{1,2}[A-Z]{3}\d{2})-([\d.]+)-(C|P)(?:-USDT)?$/i;

const SWEET_DELTA_MIN = 0.13;
const SWEET_DELTA_MAX = 0.15;
const FALLBACK_DELTA_MIN = 0.08;
const FALLBACK_DELTA_MAX = 0.18;
const TARGET_DELTA = 0.14;

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseNumeric(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIvPercent(markIv: string | undefined): number {
  const value = parseNumeric(markIv);
  if (value === null || value <= 0) return 0;
  // Bybit markIv is decimal (0.324 = 32.4%)
  return round(value < 3 ? value * 100 : value, 2);
}

/** Parse Bybit option symbol, e.g. BTC-29MAY24-79000-C or BTC-13FEB25-89000-P-USDT */
export function parseOptionSymbol(symbol: string): ParsedOptionSymbol | null {
  const match = symbol.trim().match(SYMBOL_PATTERN);
  if (!match) return null;

  const [, base, expiryCode, strikeRaw, sideRaw] = match;
  const strike = Number(strikeRaw);
  if (!Number.isFinite(strike)) return null;

  const expiryTime = parseExpiryCode(expiryCode.toUpperCase());
  if (expiryTime === null) return null;

  const side: OptionSide = sideRaw.toUpperCase() === "C" ? "CALL" : "PUT";

  return {
    base: base.toUpperCase(),
    expiryCode: expiryCode.toUpperCase(),
    strike,
    side,
    expiry: new Date(expiryTime).toISOString().slice(0, 10),
    expiryTime,
  };
}

function parseExpiryCode(code: string): number | null {
  const match = code.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  const year = 2000 + Number(match[3]);

  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }

  // Expiry at 08:00 UTC (15:00 TH) — align with Bybit daily settle
  return Date.UTC(year, month, day, 8, 0, 0, 0);
}

function utcDayKey(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10);
}

/** Prefer today's expiry, otherwise nearest future (or nearest overall). */
export function selectTargetExpiryTime(
  expiryTimes: number[],
  now = Date.now(),
): number | null {
  const unique = [...new Set(expiryTimes)].sort((a, b) => a - b);
  if (unique.length === 0) return null;

  const todayKey = utcDayKey(now);
  const todayExpiry = unique.find((time) => utcDayKey(time) === todayKey);
  if (todayExpiry !== undefined) return todayExpiry;

  const future = unique.filter((time) => time >= now);
  if (future.length > 0) return future[0];

  return unique.reduce((nearest, time) =>
    Math.abs(time - now) < Math.abs(nearest - now) ? time : nearest,
  );
}

function hasValidQuotes(bid: number, ask: number, markPrice: number): boolean {
  return bid > 0 && ask > 0 && markPrice > 0;
}

/** Parse one Bybit option ticker row into a normalized candidate. */
export function parseOptionTicker(
  ticker: OptionTickerItem,
): ParsedOptionCandidate | null {
  const symbol = ticker.symbol;
  if (!symbol) return null;

  const parsedSymbol = parseOptionSymbol(symbol);
  if (!parsedSymbol) return null;

  const bid = parseNumeric(ticker.bid1Price) ?? 0;
  const ask = parseNumeric(ticker.ask1Price) ?? 0;
  const markPrice = parseNumeric(ticker.markPrice) ?? 0;
  const delta = parseNumeric(ticker.delta) ?? 0;
  const iv = parseIvPercent(ticker.markIv);

  if (!hasValidQuotes(bid, ask, markPrice)) return null;

  const deliveryTime = parseNumeric(ticker.deliveryTime);
  const expiry =
    deliveryTime !== null && deliveryTime > 0
      ? new Date(deliveryTime).toISOString().slice(0, 10)
      : parsedSymbol.expiry;

  return {
    symbol,
    side: parsedSymbol.side,
    strike: parsedSymbol.strike,
    expiry,
    bid: round(bid, 2),
    ask: round(ask, 2),
    markPrice: round(markPrice, 2),
    delta: round(delta, 4),
    iv,
  };
}

function deltaDistance(delta: number): number {
  return Math.abs(Math.abs(delta) - TARGET_DELTA);
}

function filterByDeltaRange(
  items: ParsedOptionCandidate[],
  min: number,
  max: number,
): ParsedOptionCandidate[] {
  return items.filter(({ delta }) => {
    const absDelta = Math.abs(delta);
    return absDelta >= min && absDelta <= max;
  });
}

function sortByDeltaProximity(
  items: ParsedOptionCandidate[],
): ParsedOptionCandidate[] {
  return [...items].sort(
    (a, b) => deltaDistance(a.delta) - deltaDistance(b.delta),
  );
}

/**
 * Select sweet-spot candidates (|delta| 0.13–0.15), or fallback 0.08–0.18.
 * Sorted by |delta| closest to 0.14.
 */
export function selectDeltaCandidates(
  items: ParsedOptionCandidate[],
): ParsedOptionCandidate[] {
  const sweet = sortByDeltaProximity(
    filterByDeltaRange(items, SWEET_DELTA_MIN, SWEET_DELTA_MAX),
  );

  if (sweet.length > 0) return sweet;

  return sortByDeltaProximity(
    filterByDeltaRange(items, FALLBACK_DELTA_MIN, FALLBACK_DELTA_MAX),
  );
}

function resolveExpiryTime(
  ticker: OptionTickerItem,
  parsedSymbol: ParsedOptionSymbol,
): number {
  const deliveryTime = parseNumeric(ticker.deliveryTime);
  if (deliveryTime !== null && deliveryTime > 0) return deliveryTime;
  return parsedSymbol.expiryTime;
}

/**
 * Parse Bybit option tickers: target expiry, split calls/puts, rank candidates.
 */
export function parseOptionChain(
  tickers: OptionTickerItem[],
  now = Date.now(),
): OptionChainResult {
  const empty: OptionChainResult = {
    expiry: "",
    expiryTime: 0,
    calls: [],
    puts: [],
    candidates: [],
  };

  if (tickers.length === 0) return empty;

  const expiryTimes: number[] = [];

  for (const ticker of tickers) {
    const symbol = ticker.symbol;
    if (!symbol) continue;
    const parsed = parseOptionSymbol(symbol);
    if (!parsed) continue;
    expiryTimes.push(resolveExpiryTime(ticker, parsed));
  }

  const targetExpiryTime = selectTargetExpiryTime(expiryTimes, now);
  if (targetExpiryTime === null) return empty;

  const targetDay = utcDayKey(targetExpiryTime);
  const chainTickers = tickers.filter((ticker) => {
    const parsed = parseOptionSymbol(ticker.symbol ?? "");
    if (!parsed) return false;
    const expiryTime = resolveExpiryTime(ticker, parsed);
    return utcDayKey(expiryTime) === targetDay;
  });

  const parsed = chainTickers
    .map(parseOptionTicker)
    .filter((item): item is ParsedOptionCandidate => item !== null);

  const calls = parsed.filter((item) => item.side === "CALL");
  const puts = parsed.filter((item) => item.side === "PUT");
  const candidates = selectDeltaCandidates(parsed);

  return {
    expiry: targetDay,
    expiryTime: targetExpiryTime,
    calls: sortByDeltaProximity(calls),
    puts: sortByDeltaProximity(puts),
    candidates,
  };
}

/** Convenience alias — returns ranked candidates for target expiry chain. */
export function findOptionCandidates(
  tickers: OptionTickerItem[],
  now = Date.now(),
): ParsedOptionCandidate[] {
  return parseOptionChain(tickers, now).candidates;
}
