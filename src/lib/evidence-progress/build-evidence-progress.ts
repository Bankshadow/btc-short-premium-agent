import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { classifyTradeResult, calculateMaxDrawdown } from "@/lib/testnet-monitor/pnl";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
  TestnetTradeResult,
} from "@/lib/testnet-monitor/types";
import type {
  EvidenceExcludedRow,
  EvidenceLearningStatus,
  EvidenceProgressBuildInput,
  EvidenceProgressRow,
  EvidenceProgressSnapshot,
} from "./types";
import { EVIDENCE_MVP, EVIDENCE_MVP_LABEL } from "./types";

function round(n: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function parseCloseReason(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  const monitor = trimmed.match(/Autonomous testnet monitor — (.+)/i);
  if (monitor?.[1]) return monitor[1];
  return trimmed;
}

function learningStatusForTrade(
  tradeId: string,
  records: TestnetLearningRecord[],
): EvidenceLearningStatus {
  const record = records.find((r) => r.closedTradeId === tradeId);
  if (!record) return "NONE";
  return record.status;
}

function classifyJournalResult(
  netPnl: number,
): TestnetTradeResult {
  return classifyTradeResult(netPnl);
}

export interface ValidatedEvidenceEntry {
  journal: BinanceTestnetJournalEntry;
  closedTrade: TestnetClosedTrade | null;
  excluded: EvidenceExcludedRow | null;
}

export function validateEvidenceJournalEntry(input: {
  journal: BinanceTestnetJournalEntry;
  closedTrade: TestnetClosedTrade | null;
  seenPreviewIds: Set<string>;
  seenTradeIds: Set<string>;
}): ValidatedEvidenceEntry {
  const { journal, closedTrade, seenPreviewIds, seenTradeIds } = input;
  const tradeId = journal.binanceTestnetTradeId;
  const symbol = journal.symbol;

  if (journal.binanceTestnetTradeId.includes("-close")) {
    return {
      journal,
      closedTrade,
      excluded: {
        tradeId,
        symbol,
        reason: "Legacy duplicate close journal row — not counted.",
        missingDecisionLogId: false,
        missingCloseJournal: false,
        missingPnl: false,
        duplicate: true,
      },
    };
  }

  if (seenTradeIds.has(tradeId)) {
    return {
      journal,
      closedTrade,
      excluded: {
        tradeId,
        symbol,
        reason: "Duplicate trade id in journal.",
        missingDecisionLogId: false,
        missingCloseJournal: false,
        missingPnl: false,
        duplicate: true,
      },
    };
  }

  if (journal.status !== "CLOSED") {
    return {
      journal,
      closedTrade,
      excluded: {
        tradeId,
        symbol,
        reason: `Journal status ${journal.status} — evidence requires CLOSED.`,
        missingDecisionLogId: false,
        missingCloseJournal: true,
        missingPnl: false,
        duplicate: false,
      },
    };
  }

  const decisionLogId = journal.decisionLogId?.trim() ?? "";
  if (!decisionLogId) {
    return {
      journal,
      closedTrade,
      excluded: {
        tradeId,
        symbol,
        reason: "Missing decisionLogId — not linked to AI analyze cycle.",
        missingDecisionLogId: true,
        missingCloseJournal: false,
        missingPnl: false,
        duplicate: false,
      },
    };
  }

  if (journal.realizedPnl == null || !Number.isFinite(journal.realizedPnl)) {
    return {
      journal,
      closedTrade,
      excluded: {
        tradeId,
        symbol,
        reason: "Missing realized PnL on CLOSED journal entry.",
        missingDecisionLogId: false,
        missingCloseJournal: false,
        missingPnl: true,
        duplicate: false,
      },
    };
  }

  if (journal.previewId && seenPreviewIds.has(journal.previewId)) {
    return {
      journal,
      closedTrade,
      excluded: {
        tradeId,
        symbol,
        reason: `Duplicate previewId ${journal.previewId} — only first close counts.`,
        missingDecisionLogId: false,
        missingCloseJournal: false,
        missingPnl: false,
        duplicate: true,
      },
    };
  }

  seenTradeIds.add(tradeId);
  if (journal.previewId) seenPreviewIds.add(journal.previewId);

  return { journal, closedTrade, excluded: null };
}

function buildEquityFromValid(valid: EvidenceProgressRow[]): Array<{ timestamp: string; equity: number }> {
  let equity = 0;
  const series: Array<{ timestamp: string; equity: number }> = [];
  const sorted = [...valid].sort(
    (a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt),
  );
  for (const trade of sorted) {
    equity += trade.netPnl;
    series.push({ timestamp: trade.closedAt, equity: round(equity, 2) });
  }
  return series;
}

function resolveCurrentBlocker(input: {
  connected: boolean;
  completedTrades: number;
  requiredTrades: number;
  openPositionCount: number;
  excludedCount: number;
  missingDecisionLogId: number;
  duplicateWarnings: string[];
}): string | null {
  if (!input.connected) {
    return "Binance testnet not connected.";
  }
  if (input.excludedCount > 0) {
    const parts: string[] = [];
    if (input.missingDecisionLogId > 0) {
      parts.push(`${input.missingDecisionLogId} without decisionLogId`);
    }
    if (input.duplicateWarnings.length > 0) {
      parts.push(`${input.duplicateWarnings.length} duplicate`);
    }
    if (parts.length > 0) {
      return `${input.excludedCount} closed trade(s) excluded from evidence (${parts.join(", ")}).`;
    }
    return `${input.excludedCount} closed trade(s) excluded — evidence set not yet valid.`;
  }
  if (input.completedTrades >= input.requiredTrades) {
    return null;
  }
  if (input.openPositionCount > 0) {
    return `${input.openPositionCount} open position(s) — waiting for monitor to close with PnL.`;
  }
  if (input.completedTrades === 0) {
    return "No valid completed trades yet — waiting for first close cycle.";
  }
  return `${input.requiredTrades - input.completedTrades} more valid closed trade(s) needed.`;
}

function resolveNextExpectedAction(input: {
  connected: boolean;
  completedTrades: number;
  requiredTrades: number;
  openPositionCount: number;
  currentBlocker: string | null;
}): string {
  if (!input.connected) {
    return "Connect Binance testnet — live trading stays locked.";
  }
  if (input.completedTrades >= input.requiredTrades) {
    return "Evidence set complete (12/12) — review report; live remains disabled until separate readiness gates pass.";
  }
  if (input.openPositionCount > 0) {
    return `Monitor ${input.openPositionCount} open position(s) — autopilot closes on SL/TP, verdict flip, or max hold (no size increase).`;
  }
  if (input.currentBlocker?.includes("excluded")) {
    return "Fix excluded trades (decisionLogId + CLOSED journal + PnL) — do not increase risk to rush evidence.";
  }
  return "Wait for next autopilot cycle — TRADE → preview → execute when gates pass; monitor will close for evidence.";
}

export function buildEvidenceProgress(
  input: EvidenceProgressBuildInput,
): EvidenceProgressSnapshot {
  const requiredTrades = input.requiredTrades ?? GOAL_MIN_TRADES_FOR_TRUST;
  const closedById = new Map(input.closedTrades.map((t) => [t.id, t]));
  const seenPreviewIds = new Set<string>();
  const seenTradeIds = new Set<string>();
  const validRows: EvidenceProgressRow[] = [];
  const excludedRows: EvidenceExcludedRow[] = [];
  const duplicateTradeWarnings: string[] = [];

  const closedJournal = input.journal.filter((j) => j.status === "CLOSED");

  for (const entry of closedJournal) {
    const validated = validateEvidenceJournalEntry({
      journal: entry,
      closedTrade: closedById.get(entry.binanceTestnetTradeId) ?? null,
      seenPreviewIds,
      seenTradeIds,
    });
    if (validated.excluded) {
      excludedRows.push(validated.excluded);
      if (validated.excluded.duplicate) {
        duplicateTradeWarnings.push(
          `${validated.excluded.symbol}: ${validated.excluded.reason}`,
        );
      }
      continue;
    }

    const j = validated.journal;
    const closedTrade = validated.closedTrade;
    const netPnl = j.realizedPnl ?? closedTrade?.netPnl ?? 0;
    const fee = j.fees ?? closedTrade?.fee ?? 0;
    const grossPnl = netPnl + fee;
    const openedAt = j.executedAt ?? j.createdAt;
    const closedAt = j.closedAt ?? closedTrade?.closedAt ?? j.createdAt;

    validRows.push({
      tradeId: j.binanceTestnetTradeId,
      symbol: j.symbol,
      side: j.side === "BUY" ? "LONG" : "SHORT",
      result: closedTrade?.result ?? classifyJournalResult(netPnl),
      netPnl: round(netPnl),
      grossPnl: round(grossPnl),
      strategy: j.source ?? closedTrade?.strategy ?? null,
      decisionLogId: j.decisionLogId!,
      closeReason: parseCloseReason(j.operatorNote ?? closedTrade?.notes),
      learningStatus: learningStatusForTrade(
        j.binanceTestnetTradeId,
        input.learningRecords,
      ),
      openedAt,
      closedAt,
      valid: true,
      evidenceIndex: 0,
    });
  }

  validRows.sort(
    (a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt),
  );
  validRows.forEach((row, index) => {
    row.evidenceIndex = index + 1;
  });

  for (const trade of input.closedTrades) {
    const journalMatch = input.journal.find(
      (j) => j.binanceTestnetTradeId === trade.id,
    );
    if (!journalMatch || journalMatch.status !== "CLOSED") {
      if (!excludedRows.some((e) => e.tradeId === trade.id)) {
        excludedRows.push({
          tradeId: trade.id,
          symbol: trade.symbol,
          reason: "Closed trade in monitor without CLOSED journal entry.",
          missingDecisionLogId: !trade.decisionLogId,
          missingCloseJournal: true,
          missingPnl: trade.netPnl == null,
          duplicate: false,
        });
      }
    }
  }

  const winCount = validRows.filter((t) => t.result === "WIN").length;
  const lossCount = validRows.filter((t) => t.result === "LOSS").length;
  const breakevenCount = validRows.filter((t) => t.result === "BREAKEVEN").length;
  const realizedPnl = round(validRows.reduce((s, t) => s + t.netPnl, 0));
  const averagePnl =
    validRows.length > 0 ? round(realizedPnl / validRows.length) : 0;
  const equitySeries = buildEquityFromValid(validRows);
  const maxDrawdown = calculateMaxDrawdown(equitySeries);

  const completedTrades = validRows.length;
  const remainingTrades = Math.max(0, requiredTrades - completedTrades);
  const evidenceSetReady = completedTrades >= requiredTrades;

  const missingDecisionLogId = excludedRows.filter(
    (e) => e.missingDecisionLogId,
  ).length;
  const missingCloseJournal = excludedRows.filter(
    (e) => e.missingCloseJournal,
  ).length;
  const missingPnl = excludedRows.filter((e) => e.missingPnl).length;

  const validityNotes: string[] = [];
  if (excludedRows.length === 0 && completedTrades > 0) {
    validityNotes.push("All closed journal rows pass evidence validation.");
  }
  if (excludedRows.length > 0) {
    validityNotes.push(
      `${excludedRows.length} trade(s) excluded — not counted toward 12-trade evidence.`,
    );
  }
  if (missingDecisionLogId > 0) {
    validityNotes.push(
      `${missingDecisionLogId} excluded due to missing decisionLogId.`,
    );
  }
  if (duplicateTradeWarnings.length > 0) {
    validityNotes.push(
      `${duplicateTradeWarnings.length} duplicate close/preview warning(s).`,
    );
  }
  if (evidenceSetReady) {
    validityNotes.push(
      "Minimum 12 valid completed trades reached — evidence set ready for evaluation.",
    );
  }

  const evidenceSetValid =
    excludedRows.length === 0 ||
    (excludedRows.every((e) => !e.missingDecisionLogId && !e.missingPnl) &&
      duplicateTradeWarnings.length === 0);

  const firstTradeAt = validRows[0]?.closedAt ?? null;
  const latestTradeAt = validRows[validRows.length - 1]?.closedAt ?? null;
  const lastCompletedTrade =
    validRows.length > 0 ? validRows[validRows.length - 1]! : null;

  const currentBlocker = resolveCurrentBlocker({
    connected: input.connected,
    completedTrades,
    requiredTrades,
    openPositionCount: input.openPositionCount,
    excludedCount: excludedRows.length,
    missingDecisionLogId,
    duplicateWarnings: duplicateTradeWarnings,
  });

  const nextExpectedAction = resolveNextExpectedAction({
    connected: input.connected,
    completedTrades,
    requiredTrades,
    openPositionCount: input.openPositionCount,
    currentBlocker,
  });

  return {
    mvp: EVIDENCE_MVP,
    label: EVIDENCE_MVP_LABEL,
    completedTrades,
    requiredTrades,
    remainingTrades,
    evidenceSetReady,
    evidenceSetValid,
    validityNotes,
    firstTradeAt,
    latestTradeAt,
    winCount,
    lossCount,
    breakevenCount,
    realizedPnl,
    averagePnl,
    maxDrawdown,
    duplicateTradeWarnings,
    missingDecisionLogId,
    missingCloseJournal,
    missingPnl,
    learningRecordCount: input.learningRecords.length,
    excludedTradeCount: excludedRows.length,
    rawClosedJournalCount: closedJournal.length,
    currentBlocker,
    lastCompletedTrade,
    nextExpectedAction,
    validTrades: validRows,
    excludedTrades: excludedRows,
    liveTradingBlocked: true,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function emptyEvidenceProgress(
  requiredTrades = GOAL_MIN_TRADES_FOR_TRUST,
): EvidenceProgressSnapshot {
  return buildEvidenceProgress({
    journal: [],
    closedTrades: [],
    learningRecords: [],
    openPositionCount: 0,
    connected: false,
    requiredTrades,
  });
}
