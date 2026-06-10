import { emptyEvidenceProgress } from "@/lib/evidence-progress";
import { emptyEvidenceQualitySnapshot } from "@/lib/evidence-quality/build-evidence-quality";
import { emptyIntegratedRiskBudget } from "@/lib/integrated-risk-budget/empty-snapshot";
import { emptyIntegratedStrategyHealth } from "@/lib/integrated-strategy-health/empty-snapshot";
import { emptyMicroLiveReadiness } from "@/lib/micro-live-readiness/empty-snapshot";
import { emptyMonitorReliabilitySnapshot } from "@/lib/monitor-reliability/empty-snapshot";
import { buildMicroLiveReadinessReviewFromSnapshots } from "./build-micro-live-readiness-review";
import type { MicroLiveReadinessReviewSnapshot } from "./types";

export function emptyMicroLiveReadinessReview(): MicroLiveReadinessReviewSnapshot {
  return buildMicroLiveReadinessReviewFromSnapshots({
    connected: false,
    testnetConfigured: false,
    evidenceProgress: emptyEvidenceProgress(),
    evidenceQuality: emptyEvidenceQualitySnapshot(),
    integratedStrategyHealth: emptyIntegratedStrategyHealth(),
    integratedRiskBudget: emptyIntegratedRiskBudget(),
    monitorReliability: emptyMonitorReliabilitySnapshot(),
    microLiveReadiness: emptyMicroLiveReadiness(),
  });
}
