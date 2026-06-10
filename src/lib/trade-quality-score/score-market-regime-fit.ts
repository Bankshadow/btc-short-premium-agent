import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { QUANT_STRATEGY_SEEDS } from "@/lib/quant-strategy-importer/seed-strategies";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeRegime(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "_");
}

function regimeMatchesFit(regime: string, fitList: string[]): boolean {
  const normalized = normalizeRegime(regime);
  return fitList.some((fit) => {
    const f = normalizeRegime(fit);
    return normalized.includes(f) || f.includes(normalized);
  });
}

/** Score how well the trade's market regime matched strategy expectations. */
export function scoreMarketRegimeFit(
  entry: DecisionLogEntry,
  strategyTag?: string | null,
): number {
  const regime = entry.marketRegime?.trim();
  if (!regime || regime === "Unknown") return 32;

  let score = 52;
  const tag = strategyTag?.trim() ?? null;
  const seed =
    tag != null
      ? QUANT_STRATEGY_SEEDS.find(
          (s) =>
            s.sourceId === tag ||
            s.strategyName === tag ||
            s.sourceId.includes(tag),
        )
      : null;

  if (seed?.marketRegimeFit?.length) {
    if (regimeMatchesFit(regime, seed.marketRegimeFit)) score += 28;
    else score -= 18;
  } else if (/trend|bull|bear/i.test(regime)) {
    score += 12;
  } else if (/range|quiet|mixed/i.test(regime)) {
    score += 8;
  }

  if (entry.finalVerdict === "TRADE" && /trend/i.test(regime)) score += 6;
  if (entry.finalVerdict === "SKIP" && /mixed|unclear/i.test(regime)) score += 8;

  return clamp(score);
}
