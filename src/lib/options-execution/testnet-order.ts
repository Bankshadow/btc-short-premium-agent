import { blockLiveOptionsAttempt, loadOptionsExecutionConfig } from "./config";
import { summarizeRiskChecks, runOptionsRiskChecks } from "./risk-checks";
import type { OptionsOrderPreview, OptionsPreviewJournalEntry } from "./types";
import { journalEntryFromPreview } from "./preview-journal-store";

export interface TestnetOrderResult {
  ok: boolean;
  simulated: true;
  realOrderSent: false;
  simulatedOrderId: string | null;
  journalEntry: OptionsPreviewJournalEntry | null;
  error?: string;
  blockers?: string[];
}

export function simulateTestnetOptionsOrder(
  preview: OptionsOrderPreview,
  journal: OptionsPreviewJournalEntry[],
): TestnetOrderResult {
  const liveBlock = blockLiveOptionsAttempt();
  if (liveBlock) {
    return {
      ok: false,
      simulated: true,
      realOrderSent: false,
      simulatedOrderId: null,
      journalEntry: journalEntryFromPreview(preview, {
        paperOrderLinked: false,
        paperOrderId: null,
        status: "BLOCKED_LIVE_ATTEMPT",
      }),
      error: liveBlock,
      blockers: [liveBlock],
    };
  }

  const config = loadOptionsExecutionConfig();
  if (!config.testnetEnabled) {
    return {
      ok: false,
      simulated: true,
      realOrderSent: false,
      simulatedOrderId: null,
      journalEntry: null,
      error: "OPTIONS_TESTNET_ENABLED is not true — testnet order simulation blocked.",
    };
  }

  const checks = runOptionsRiskChecks({
    ticket: preview.ticket,
    instrument: preview.ticket?.optionsInstrument ?? null,
    margin: preview.margin,
    journal,
  });
  const summary = summarizeRiskChecks(checks);

  if (!preview.valid || !summary.valid) {
    return {
      ok: false,
      simulated: true,
      realOrderSent: false,
      simulatedOrderId: null,
      journalEntry: journalEntryFromPreview(preview, {
        paperOrderLinked: false,
        paperOrderId: null,
        status: "REJECTED",
      }),
      error: summary.blockingReasons.join("; ") || "Preview invalid.",
      blockers: summary.blockingReasons,
    };
  }

  const simulatedOrderId = `testnet-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    ok: true,
    simulated: true,
    realOrderSent: false,
    simulatedOrderId,
    journalEntry: journalEntryFromPreview(preview, {
      paperOrderLinked: false,
      paperOrderId: null,
      status: "TESTNET_SIMULATED",
      operatorNote: `Simulated testnet order ${simulatedOrderId} — no Bybit API call.`,
    }),
  };
}
