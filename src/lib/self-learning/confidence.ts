import type { ConfidenceLevel } from "@/lib/agents/types";

export function confidenceToProbability(level: ConfidenceLevel): number {
  if (level === "HIGH") return 0.85;
  if (level === "MEDIUM") return 0.6;
  return 0.35;
}

export function gradeFromHitRate(
  hitRate: number,
  sampleSize: number,
): "A" | "B" | "C" | "D" | "F" | "INSUFFICIENT_DATA" {
  if (sampleSize < 2) return "INSUFFICIENT_DATA";
  if (hitRate >= 75) return "A";
  if (hitRate >= 65) return "B";
  if (hitRate >= 55) return "C";
  if (hitRate >= 45) return "D";
  return "F";
}
