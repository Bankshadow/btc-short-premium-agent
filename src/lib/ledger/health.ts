import type { LedgerEntry, LedgerHealthReport } from "./types";
import { hashLedgerPayload } from "./hash";

export function evaluateLedgerHealth(
  entries: LedgerEntry[],
  lastSyncedAt: string | null = null,
): LedgerHealthReport {
  const issues: string[] = [];
  let missingHashes = 0;
  let brokenLinks = 0;
  let orphanTrades = 0;

  const decisionIds = new Set(
    entries
      .filter((e) => e.entryKind === "DECISION")
      .map((e) => e.linkedDecisionId)
      .filter(Boolean) as string[],
  );

  const legacyKeys = new Map<string, number>();
  for (const e of entries) {
    if (!e.hash) {
      missingHashes++;
      issues.push(`Entry ${e.ledgerEntryId} missing hash`);
      continue;
    }
    const expected = hashLedgerPayload(e.payload);
    if (e.hash !== expected && e.entryKind !== "CORRECTION") {
      missingHashes++;
      issues.push(`Hash mismatch on ${e.ledgerEntryId}`);
    }
    if (e.legacyRef) {
      const key = `${e.legacyRef.store}:${e.legacyRef.id}:${e.entryKind}`;
      legacyKeys.set(key, (legacyKeys.get(key) ?? 0) + 1);
    }
    if (
      e.entryKind === "TRADE" &&
      e.linkedDecisionId &&
      !decisionIds.has(e.linkedDecisionId) &&
      e.environment !== "DEMO"
    ) {
      orphanTrades++;
    }
    if (e.entryKind === "TRADE" && !e.linkedTradeId) {
      brokenLinks++;
    }
  }

  const duplicateLegacyRefs = [...legacyKeys.values()].filter((c) => c > 1).length;
  if (duplicateLegacyRefs > 0) {
    issues.push(`${duplicateLegacyRefs} duplicate legacy reference(s)`);
  }
  if (orphanTrades > 0) {
    issues.push(`${orphanTrades} trade(s) without matching decision`);
  }

  const liveEntryCount = entries.filter((e) => e.environment === "LIVE").length;
  const healthy =
    missingHashes === 0 && duplicateLegacyRefs === 0 && brokenLinks === 0;

  return {
    healthy,
    entryCount: entries.length,
    liveEntryCount,
    orphanTrades,
    missingHashes,
    duplicateLegacyRefs,
    brokenLinks,
    issues: issues.slice(0, 20),
    lastSyncedAt,
  };
}
