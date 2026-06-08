import { PREDICTION_ARB_DEFAULTS } from "./config";
import type { NormalizedPredictionMarket, ResolutionRiskScore } from "./types";

const AMBIGUOUS_PHRASES = [
  "may",
  "might",
  "subject to",
  "admin review",
  "ambiguous",
  "discretion",
  "reasonable",
  "interpretation",
  "revised",
  "data source",
];

const ORACLE_PHRASES = [
  "uma",
  "oracle",
  "optimistic oracle",
  "admin",
  "polymarket",
  "manual resolution",
  "dispute",
];

const SUBJECTIVE_PHRASES = [
  "widely considered",
  "consensus",
  "significant",
  "substantial",
  "in the opinion",
  "generally accepted",
];

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function countPhrases(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p)).length;
}

/**
 * ResolutionRiskScorer — rules parsing, ambiguity, oracle, deadline risk.
 */
export function scoreResolutionRisk(
  market: NormalizedPredictionMarket,
  config: typeof PREDICTION_ARB_DEFAULTS = PREDICTION_ARB_DEFAULTS,
): ResolutionRiskScore {
  const rules = market.resolutionRules ?? "";
  const flags: string[] = [];

  const ambiguityHits = countPhrases(rules, AMBIGUOUS_PHRASES);
  const oracleHits = countPhrases(rules, ORACLE_PHRASES);
  const subjectiveHits = countPhrases(rules, SUBJECTIVE_PHRASES);

  const ambiguity = clamp(ambiguityHits * 12 + (rules.length < 80 ? 15 : 0));
  const oracleRisk = clamp(oracleHits * 14 + (rules.toLowerCase().includes("uma") ? 10 : 0));
  const subjectiveWording = clamp(subjectiveHits * 16);

  let deadlineRisk = 20;
  if (market.resolutionDeadline) {
    const ms = new Date(market.resolutionDeadline).getTime() - Date.now();
    const days = ms / 86_400_000;
    if (days < 7) {
      deadlineRisk = 75;
      flags.push("Resolution within 7 days — capital lock risk elevated.");
    } else if (days < 30) {
      deadlineRisk = 45;
    } else {
      deadlineRisk = 15;
    }
  } else {
    deadlineRisk = 55;
    flags.push("No resolution deadline published.");
  }

  if (ambiguityHits > 0) flags.push("Ambiguous resolution wording detected.");
  if (oracleHits > 0) flags.push("Oracle / admin resolution dependency.");
  if (subjectiveHits > 0) flags.push("Subjective criteria in market rules.");

  const score = clamp(
    ambiguity * 0.3 + oracleRisk * 0.35 + deadlineRisk * 0.2 + subjectiveWording * 0.15,
  );
  const blocked = score > config.maxResolutionRiskScore;

  return {
    score,
    ambiguity,
    oracleRisk,
    deadlineRisk,
    subjectiveWording,
    blocked,
    flags,
    summary: blocked
      ? `Resolution risk ${score}/100 exceeds threshold ${config.maxResolutionRiskScore}.`
      : `Resolution risk ${score}/100 within acceptable range.`,
  };
}
