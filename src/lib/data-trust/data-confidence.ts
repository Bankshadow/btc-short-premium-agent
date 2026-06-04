import { worstConfidence } from "./data-freshness";
import type {
  DataConfidenceLevel,
  DataConfidenceResult,
  DataProvenanceField,
} from "./types";

const REQUIRED_CRITICAL_FIELDS = [
  "BTC price",
  "Option IV",
  "Option delta",
];

function confidenceToScore(level: DataConfidenceLevel): number {
  switch (level) {
    case "HIGH":
      return 100;
    case "MEDIUM":
      return 72;
    case "LOW":
      return 45;
    case "CRITICAL":
      return 15;
    default:
      return 50;
  }
}

export function computeDataConfidence(
  provenance: DataProvenanceField[],
): DataConfidenceResult {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  for (const name of REQUIRED_CRITICAL_FIELDS) {
    const row = provenance.find((p) => p.fieldName === name);
    if (!row || row.source === "MISSING" || row.confidence === "CRITICAL") {
      criticalIssues.push(
        row?.issue ?? `${name} missing or unreliable for desk TRADE`,
      );
    }
  }

  for (const row of provenance) {
    if (row.confidence === "CRITICAL" && row.issue) {
      if (!criticalIssues.includes(row.issue)) {
        criticalIssues.push(row.issue);
      }
    } else if (
      (row.confidence === "LOW" || row.confidence === "MEDIUM") &&
      row.issue
    ) {
      warnings.push(row.issue);
    } else if (row.confidence === "LOW" && !row.issue) {
      warnings.push(`${row.fieldName}: low confidence (${row.source})`);
    }
  }

  const grades = provenance.map((p) => p.confidence);
  const grade = worstConfidence(grades);

  const avg =
    provenance.length > 0
      ? provenance.reduce((s, p) => s + confidenceToScore(p.confidence), 0) /
        provenance.length
      : 0;

  let score = Math.round(avg);
  if (criticalIssues.length > 0) score = Math.min(score, 25);
  if (grade === "CRITICAL") score = Math.min(score, 20);
  if (grade === "LOW") score = Math.min(score, 50);

  const tradeAllowed =
    criticalIssues.length === 0 &&
    grade !== "CRITICAL" &&
    grade !== "LOW";

  return {
    score,
    grade,
    criticalIssues: [...new Set(criticalIssues)],
    warnings: [...new Set(warnings)].slice(0, 12),
    tradeAllowed,
  };
}
