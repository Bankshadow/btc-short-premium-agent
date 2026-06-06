import type { AnalyzeApiResponse } from "@/lib/types/market";

export function buildActionKey(
  actionType: string,
  detail?: string | null,
): string {
  const normalized = (detail ?? "").trim().toLowerCase().slice(0, 120);
  return `${actionType}:${normalized || "default"}`;
}

export function buildTradeCandidateKey(input: {
  symbol: string;
  side: string;
  reason?: string | null;
  source?: string | null;
}): string {
  const reason = (input.reason ?? "signal").trim().toLowerCase().slice(0, 80);
  const source = (input.source ?? "autopilot").trim().toLowerCase();
  return `${input.symbol}:${input.side}:${source}:${reason}`;
}

export function buildPreviewFingerprint(input: {
  symbol: string;
  side: string;
  notionalUsd?: number | null;
  reason?: string | null;
}): string {
  const notional = Math.round(input.notionalUsd ?? 0);
  const reason = (input.reason ?? "").trim().toLowerCase().slice(0, 60);
  return `preview:${input.symbol}:${input.side}:${notional}:${reason}`;
}

export function buildApiErrorKey(error?: string | null): string | null {
  if (!error) return null;
  return error.trim().toLowerCase().slice(0, 100);
}

export function buildMarketContextHash(
  analysis: AnalyzeApiResponse | null | undefined,
): string | null {
  if (!analysis) return null;
  const spot = analysis.step1_marketSnapshot?.spotPrice ?? 0;
  const verdict =
    analysis.tradingDesk?.weightedCommittee?.weightedVerdict ??
    analysis.step5_verdict?.recommendation ??
    "NONE";
  const trust = analysis.dataTrust?.grade ?? "—";
  const combination =
    analysis.combinationRead?.label ??
    analysis.step4_combinationRead?.label ??
    "—";
  const funding = analysis.step1_marketSnapshot?.fundingRate ?? 0;
  return [
    Math.round(Number(spot)),
    String(verdict).toUpperCase(),
    trust,
    String(combination).slice(0, 40),
    Number(funding).toFixed(5),
  ].join("|");
}
