import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { EvidenceProgressRow } from "@/lib/evidence-progress/types";
import type { TestnetMonitorJournalEvent } from "@/lib/testnet-monitor/types";
import type {
  MicroLiveReadinessBuildInput,
  MicroLiveReadinessStatus,
  ReadinessChecklistItem,
  ReadinessEvidenceLink,
  ReadinessReport,
} from "./types";
import { MICRO_LIVE_EVIDENCE_REQUIRED } from "./types";

function hasReduceOnlyCloseEvidence(input: {
  journal: BinanceTestnetJournalEntry[];
  monitorEvents: TestnetMonitorJournalEvent[];
}): boolean {
  const fromJournal = input.journal.some(
    (j) =>
      j.status === "CLOSED" &&
      (j.closeAttempt === true ||
        /reduce-only|Autonomous testnet monitor/i.test(j.operatorNote ?? "")),
  );
  const fromMonitor = input.monitorEvents.some(
    (e) =>
      e.eventType === "POSITION_CLOSED" || e.eventType === "CLOSE_REQUESTED",
  );
  return fromJournal || fromMonitor;
}

function buildEvidenceLinks(
  validTrades: EvidenceProgressRow[],
  learningRecordIds: string[],
): ReadinessEvidenceLink[] {
  const links: ReadinessEvidenceLink[] = [];
  for (const trade of validTrades.slice(0, 12)) {
    links.push({
      kind: "trade",
      id: trade.tradeId,
      label: `${trade.symbol} ${trade.result} ${trade.netPnl.toFixed(2)}`,
    });
    links.push({
      kind: "decision",
      id: trade.decisionLogId,
      label: `Decision ${trade.decisionLogId}`,
    });
    links.push({
      kind: "pnl",
      id: trade.tradeId,
      label: `PnL ${trade.netPnl.toFixed(2)}`,
    });
    links.push({
      kind: "journal",
      id: trade.tradeId,
      label: `CLOSED journal ${trade.tradeId}`,
    });
  }
  for (const id of learningRecordIds.slice(0, 12)) {
    links.push({ kind: "learning", id, label: `Learning ${id}` });
  }
  return links;
}

export function buildMicroLiveReadinessReport(
  input: MicroLiveReadinessBuildInput,
): ReadinessReport {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingConfigItems: string[] = [];
  const checklist: ReadinessChecklistItem[] = [];

  const validCount = input.evidenceValidTrades.length;
  const closedJournalCount = input.journal.filter(
    (j) => j.status === "CLOSED",
  ).length;
  const learningForClosed = input.learningRecords.filter((r) =>
    input.evidenceValidTrades.some(
      (t) => t.tradeId === (r.tradeId ?? r.closedTradeId),
    ),
  ).length;
  const reduceOnlyOk = hasReduceOnlyCloseEvidence({
    journal: input.journal,
    monitorEvents: input.monitorEvents,
  });

  const pushCheck = (item: ReadinessChecklistItem) => {
    checklist.push(item);
    if (!item.passed && item.hardBlock) blockers.push(item.detail ?? item.label);
    else if (!item.passed) warnings.push(item.detail ?? item.label);
  };

  pushCheck({
    id: "evidence_12",
    label: "12 valid completed testnet trades",
    passed: validCount >= MICRO_LIVE_EVIDENCE_REQUIRED,
    hardBlock: true,
    detail:
      validCount >= MICRO_LIVE_EVIDENCE_REQUIRED
        ? null
        : `${validCount}/${MICRO_LIVE_EVIDENCE_REQUIRED} valid evidence trades.`,
  });

  pushCheck({
    id: "decision_log_id",
    label: "All evidence trades have decisionLogId",
    passed: input.evidenceMissingDecisionLogId === 0,
    hardBlock: true,
    detail:
      input.evidenceMissingDecisionLogId === 0
        ? null
        : `${input.evidenceMissingDecisionLogId} trade(s) missing decisionLogId.`,
  });

  pushCheck({
    id: "closed_journal",
    label: "CLOSED journal for completed trades",
    passed: input.evidenceMissingCloseJournal === 0 && closedJournalCount > 0,
    hardBlock: true,
    detail:
      input.evidenceMissingCloseJournal === 0
        ? closedJournalCount > 0
          ? null
          : "No CLOSED journal entries."
        : `${input.evidenceMissingCloseJournal} closed trade(s) missing journal.`,
  });

  pushCheck({
    id: "realized_pnl",
    label: "Realized PnL on CLOSED trades",
    passed: input.evidenceMissingPnl === 0,
    hardBlock: true,
    detail:
      input.evidenceMissingPnl === 0
        ? null
        : `${input.evidenceMissingPnl} CLOSED journal(s) missing PnL.`,
  });

  pushCheck({
    id: "learning_records",
    label: "Learning records for closed trades",
    passed:
      validCount === 0 ||
      learningForClosed >= Math.min(validCount, closedJournalCount),
    hardBlock: true,
    detail:
      learningForClosed >= validCount
        ? null
        : `Missing learning records for ${validCount - learningForClosed} closed trade(s).`,
  });

  pushCheck({
    id: "reduce_only_close",
    label: "Reduce-only close evidence",
    passed: reduceOnlyOk,
    hardBlock: true,
    detail: reduceOnlyOk
      ? null
      : "No POSITION_CLOSED / reduce-only close evidence in journal or monitor events.",
  });

  pushCheck({
    id: "critical_incident",
    label: "No unresolved critical incident",
    passed: !input.criticalIncidentOpen,
    hardBlock: true,
    detail: input.criticalIncidentOpen
      ? input.criticalIncidentTitle ?? "Critical incident open."
      : null,
  });

  pushCheck({
    id: "double_confirm",
    label: "Double confirm enabled for testnet",
    passed: input.requireDoubleConfirm,
    hardBlock: true,
    detail: input.requireDoubleConfirm
      ? null
      : "BINANCE_REQUIRE_DOUBLE_CONFIRM is disabled.",
  });

  if (!input.requireDoubleConfirm) {
    missingConfigItems.push("Enable BINANCE_REQUIRE_DOUBLE_CONFIRM=true");
  }

  pushCheck({
    id: "kill_switch",
    label: "Kill switch thresholds configured",
    passed: input.killSwitchConfigured,
    hardBlock: true,
    detail: input.killSwitchConfigured
      ? null
      : "Kill switch daily loss limit not configured.",
  });

  pushCheck({
    id: "live_env_locked",
    label: "Live execution stays disabled",
    passed: !input.liveExecutionEnabled && input.liveBlocked,
    hardBlock: true,
    detail:
      !input.liveExecutionEnabled && input.liveBlocked
        ? null
        : input.liveExecutionEnabled
          ? "LIVE_EXECUTION_ENABLED is true — hard block."
          : "Live trading gate not locked.",
  });

  if (input.liveExecutionEnabled) {
    missingConfigItems.push("Set LIVE_EXECUTION_ENABLED=false (live must stay off)");
  }

  pushCheck({
    id: "testnet_connected",
    label: "Binance testnet connected",
    passed: input.connected && input.testnetConfigured,
    hardBlock: false,
    detail:
      input.connected && input.testnetConfigured
        ? null
        : "Binance testnet not connected or not configured.",
  });

  if (!input.testnetConfigured) {
    missingConfigItems.push("Configure BINANCE_API_KEY / BINANCE_API_SECRET for testnet");
  }

  if (input.killSwitchPaused) {
    warnings.push("Kill switch currently paused trading — resolve before micro-live review.");
  }

  if (input.riskBlockNewTrades) {
    warnings.push("Real-time risk engine blocking new trades.");
  }

  if (input.learningPendingCount > 0) {
    warnings.push(
      `${input.learningPendingCount} learning record(s) pending review.`,
    );
  }

  if (input.evidenceExcluded.length > 0) {
    warnings.push(
      `${input.evidenceExcluded.length} excluded trade(s) not counted toward evidence.`,
    );
  }

  let readinessStatus: MicroLiveReadinessStatus = "NOT_READY";
  if (
    input.liveExecutionEnabled ||
    !input.liveBlocked ||
    (input.criticalIncidentOpen && blockers.length > 0)
  ) {
    readinessStatus = "BLOCKED";
  } else if (blockers.length > 0) {
    readinessStatus = "NOT_READY";
  } else if (
    validCount >= MICRO_LIVE_EVIDENCE_REQUIRED &&
    warnings.length === 0
  ) {
    readinessStatus = "READY_FOR_REVIEW";
  }

  const passedChecks = checklist.filter((c) => c.passed).length;
  const readinessScore =
    checklist.length > 0
      ? Math.round((passedChecks / checklist.length) * 100)
      : 0;

  const linkedLearningIds = input.learningRecords
    .filter((r) =>
      input.evidenceValidTrades.some(
        (t) => t.tradeId === (r.tradeId ?? r.closedTradeId),
      ),
    )
    .map((r) => r.learningRecordId);

  const nextRequiredActions =
    blockers.length > 0
      ? blockers.slice(0, 6)
      : warnings.length > 0
        ? warnings.slice(0, 4)
        : readinessStatus === "READY_FOR_REVIEW"
          ? [
              "Evidence complete — schedule operator micro-live review (live stays locked).",
            ]
          : [`Complete ${MICRO_LIVE_EVIDENCE_REQUIRED - validCount} more valid testnet trades.`];

  return {
    readinessStatus,
    readinessScore,
    blockers,
    warnings,
    evidenceLinks: buildEvidenceLinks(
      input.evidenceValidTrades,
      linkedLearningIds,
    ),
    nextRequiredActions,
    checklist,
    missingConfigItems,
    generatedAt: new Date().toISOString(),
  };
}
