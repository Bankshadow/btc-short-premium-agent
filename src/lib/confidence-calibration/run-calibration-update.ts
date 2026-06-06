import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { buildLearningEvaluationReport } from "@/lib/self-learning/build-learning-report";
import { loadServerEvaluationResults } from "@/lib/self-learning/evaluation-server-store";
import { buildConfidenceCalibrationProfile } from "./build-profile";
import { collectCalibrationSamples } from "./collect-samples";
import { getCachedCalibrationProfile } from "./calibration-cache";
import {
  loadCalibrationStore,
  saveCalibrationStore,
  upsertCalibrationSamples,
} from "./calibration-store";
import { CONFIDENCE_CALIBRATION_SAFETY_NOTICE } from "./types";
import type { ConfidenceCalibrationProfile, ConfidenceCalibrationStatus } from "./types";

export async function getConfidenceCalibrationStatus(
  workspaceId = "server-default",
): Promise<ConfidenceCalibrationStatus> {
  const store = await loadCalibrationStore(workspaceId);
  return {
    workspaceId,
    profile: store.profile,
    sampleCount: store.samples.length,
    lastUpdatedAt: store.lastUpdatedAt,
    safetyNotice: CONFIDENCE_CALIBRATION_SAFETY_NOTICE,
  };
}

export async function runConfidenceCalibrationUpdate(
  workspaceId = "server-default",
): Promise<{
  ok: boolean;
  profile: ConfidenceCalibrationProfile;
  samplesAdded: number;
  safetyNotice: typeof CONFIDENCE_CALIBRATION_SAFETY_NOTICE;
}> {
  const [evaluations, entriesRaw] = await Promise.all([
    loadServerEvaluationResults(),
    loadServerAnalysisJournal().catch(() => []),
  ]);
  const entries = filterProductionEntries(entriesRaw);
  const samples = collectCalibrationSamples({ evaluations, entries });
  await upsertCalibrationSamples(samples, workspaceId);

  const report = buildLearningEvaluationReport({
    storedResults: evaluations,
    entries,
  });

  const profile = buildConfidenceCalibrationProfile({
    samples,
    agentLeaderboard: report.agentLeaderboard,
  });

  const store = await loadCalibrationStore(workspaceId);
  store.profile = profile;
  store.lastUpdatedAt = profile.generatedAt;
  await saveCalibrationStore(store);

  return {
    ok: true,
    profile,
    samplesAdded: samples.length,
    safetyNotice: CONFIDENCE_CALIBRATION_SAFETY_NOTICE,
  };
}

export { getCachedCalibrationProfile };
