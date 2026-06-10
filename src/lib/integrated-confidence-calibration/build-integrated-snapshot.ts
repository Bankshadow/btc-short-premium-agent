import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
} from "@/lib/testnet-monitor/types";
import { setCachedCalibrationProfile } from "@/lib/confidence-calibration/calibration-cache";
import {
  loadCalibrationStore,
  saveCalibrationStore,
  upsertCalibrationSamples,
} from "@/lib/confidence-calibration/calibration-store";
import { buildAgentScoreboardV2FromSamples } from "./build-agent-scoreboard-v2";
import {
  buildConfidenceCalibrationProfileFromSamples,
  buildConfidenceCalibrationReport,
} from "./build-calibration-report";
import { collectTestnetCalibrationSamples } from "./collect-testnet-samples";
import { persistConfidenceCalibratedSideEffects } from "./persist-calibration-event";
import type { IntegratedConfidenceCalibrationSnapshot } from "./types";
import {
  INTEGRATED_CONFIDENCE_CALIBRATION_LABEL,
  INTEGRATED_CONFIDENCE_CALIBRATION_MVP,
} from "./types";

export async function buildIntegratedConfidenceCalibration(input: {
  journal: BinanceTestnetJournalEntry[];
  closedTrades: TestnetClosedTrade[];
  decisions: DecisionLogEntry[];
  learningRecords: TestnetLearningRecord[];
  persistSideEffects?: boolean;
}): Promise<IntegratedConfidenceCalibrationSnapshot> {
  const testnetSamples = collectTestnetCalibrationSamples(input);
  const storeBefore = await loadCalibrationStore();
  const existingIds = new Set(storeBefore.samples.map((s) => s.sampleId));

  if (testnetSamples.length > 0) {
    await upsertCalibrationSamples(testnetSamples);
  }

  const store = await loadCalibrationStore();
  const report = buildConfidenceCalibrationReport({ samples: testnetSamples });
  const profile =
    store.samples.length > 0
      ? buildConfidenceCalibrationProfileFromSamples(
          store.samples as typeof testnetSamples,
        )
      : null;

  if (profile) {
    store.profile = profile;
    store.lastUpdatedAt = profile.generatedAt;
    await saveCalibrationStore(store);
    setCachedCalibrationProfile(
      profile,
      report.confidenceAdjustmentRecommendation,
    );
  }

  const agentScoreboardV2 = buildAgentScoreboardV2FromSamples({
    samples: testnetSamples,
    report,
  });

  const newlyAdded = testnetSamples.filter((s) => !existingIds.has(s.sampleId));
  if (input.persistSideEffects && newlyAdded.length > 0) {
    await persistConfidenceCalibratedSideEffects({
      report,
      symbol: input.journal.find((j) => j.symbol)?.symbol ?? null,
    });
  }

  return {
    mvp: INTEGRATED_CONFIDENCE_CALIBRATION_MVP,
    label: INTEGRATED_CONFIDENCE_CALIBRATION_LABEL,
    report,
    profile,
    agentScoreboardV2,
    autoAgentWeightChangeAllowed: false,
    cannotIncreaseLiveRisk: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}
