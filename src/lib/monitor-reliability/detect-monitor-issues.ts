import type { BinanceOrderPreview, BinancePosition, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import type { MonitorHeartbeat, MonitorIssue, MonitorIssueKind } from "./types";
import { MONITOR_STALE_MS } from "./types";

const PRIMARY_ISSUE_KINDS: MonitorIssueKind[] = [
  "position_state_uncertain",
  "exchange_closed_not_journaled",
  "duplicate_close_attempt",
  "monitor_not_running",
  "position_not_monitored",
  "stale_mark_price",
  "closed_journal_missing_pnl",
  "expired_preview_executable",
];

export function resolvePrimaryMonitorIssueMessage(
  issues: MonitorIssue[],
): string | null {
  const unresolved = issues.filter((i) => !i.recovered);
  if (unresolved.length === 0) return null;
  for (const kind of PRIMARY_ISSUE_KINDS) {
    const match = unresolved.find((i) => i.kind === kind);
    if (match) return match.message;
  }
  return unresolved[0]?.message ?? null;
}

function heartbeatFreshForRun(
  heartbeat: MonitorHeartbeat,
  currentRunId: string | null | undefined,
): boolean {
  return Boolean(
    currentRunId &&
      heartbeat.lastRunId === currentRunId &&
      heartbeat.lastMonitorRunAt,
  );
}

const EXECUTED_STATUSES = new Set(["SUBMITTED", "FILLED", "CLOSING", "CLOSED"]);

function issue(
  kind: MonitorIssueKind,
  severity: MonitorIssue["severity"],
  message: string,
  symbol: string | null = null,
  recovered = false,
): MonitorIssue {
  return { kind, severity, symbol, message, recovered };
}

export function detectExpiredExecutablePreviews(input: {
  previewCache: Record<string, BinanceOrderPreview>;
  journal: BinanceTestnetJournalEntry[];
}): MonitorIssue[] {
  const executedPreviewIds = new Set(
    input.journal
      .filter((j) => EXECUTED_STATUSES.has(j.status))
      .map((j) => j.previewId),
  );
  const now = Date.now();
  const issues: MonitorIssue[] = [];
  for (const preview of Object.values(input.previewCache)) {
    if (now <= Date.parse(preview.expiresAt)) continue;
    if (executedPreviewIds.has(preview.previewId)) continue;
    if (preview.blocked) continue;
    issues.push(
      issue(
        "expired_preview_executable",
        "WARNING",
        `Preview ${preview.previewId} for ${preview.symbol} expired but still in cache — execute blocked until refreshed.`,
        preview.symbol,
      ),
    );
  }
  return issues;
}

export function detectMonitorIssues(input: {
  journal: BinanceTestnetJournalEntry[];
  positions: BinancePosition[];
  connected: boolean;
  autoExecuteEnabled: boolean;
  heartbeat: MonitorHeartbeat;
  previewCache?: Record<string, BinanceOrderPreview>;
  currentRunId?: string | null;
}): MonitorIssue[] {
  const issues: MonitorIssue[] = [];
  const openPositions = input.positions.filter(
    (p) => Math.abs(Number(p.positionAmt)) > 0,
  );
  const openSymbols = new Set(openPositions.map((p) => p.symbol));
  const now = Date.now();

  if (input.autoExecuteEnabled && input.connected && openPositions.length > 0) {
    const heartbeatFresh = heartbeatFreshForRun(
      input.heartbeat,
      input.currentRunId,
    );
    const lastRun = input.heartbeat.lastMonitorRunAt
      ? Date.parse(input.heartbeat.lastMonitorRunAt)
      : null;
    if (
      !heartbeatFresh &&
      (!lastRun || now - lastRun > MONITOR_STALE_MS)
    ) {
      issues.push(
        issue(
          "monitor_not_running",
          "CRITICAL",
          `Monitor heartbeat stale — last run ${input.heartbeat.lastMonitorRunAt ?? "never"}.`,
        ),
      );
      for (const pos of openPositions) {
        issues.push(
          issue(
            "position_not_monitored",
            "WARNING",
            `Open position ${pos.symbol} may not be monitored.`,
            pos.symbol,
          ),
        );
      }
    }
  }

  for (const pos of openPositions) {
    const mark = Number(pos.markPrice);
    const entry = Number(pos.entryPrice);
    if (mark <= 0 || entry <= 0) {
      issues.push(
        issue(
          "stale_mark_price",
          "WARNING",
          `${pos.symbol} mark/entry price invalid (mark ${mark}, entry ${entry}).`,
          pos.symbol,
        ),
      );
    }
  }

  const closingBySymbol = new Map<string, BinanceTestnetJournalEntry[]>();
  for (const entry of input.journal) {
    if (entry.status !== "CLOSING" && !(entry.closeAttempt && entry.status === "FILLED")) {
      continue;
    }
    const list = closingBySymbol.get(entry.symbol) ?? [];
    list.push(entry);
    closingBySymbol.set(entry.symbol, list);
  }
  for (const [symbol, rows] of closingBySymbol) {
    if (rows.length > 1) {
      issues.push(
        issue(
          "duplicate_close_attempt",
          "WARNING",
          `${rows.length} close attempts for ${symbol}.`,
          symbol,
        ),
      );
    }
  }

  for (const entry of input.journal) {
    if (entry.status === "CLOSED" && entry.realizedPnl == null) {
      issues.push(
        issue(
          "closed_journal_missing_pnl",
          "WARNING",
          `CLOSED journal ${entry.binanceTestnetTradeId} missing realized PnL.`,
          entry.symbol,
        ),
      );
    }

    if (
      (entry.status === "FILLED" || entry.status === "SUBMITTED") &&
      !openSymbols.has(entry.symbol)
    ) {
      issues.push(
        issue(
          "exchange_closed_not_journaled",
          "CRITICAL",
          `Exchange has no ${entry.symbol} position but journal is ${entry.status}.`,
          entry.symbol,
        ),
      );
    }
  }

  const reconcile = reconcileBinancePositions({
    positions: input.positions,
    journal: input.journal,
  });
  for (const mismatch of reconcile.mismatches) {
    if (mismatch.includes("no matching journal")) {
      issues.push(
        issue(
          "position_state_uncertain",
          "CRITICAL",
          mismatch,
          mismatch.match(/on (\w+)/)?.[1] ?? null,
        ),
      );
    }
  }

  if (input.previewCache) {
    issues.push(...detectExpiredExecutablePreviews({
      previewCache: input.previewCache,
      journal: input.journal,
    }));
  }

  return issues;
}

export function resolveMonitorHealth(
  issues: MonitorIssue[],
  positionStateUncertain: boolean,
): "OK" | "WARNING" | "BLOCKED" {
  if (positionStateUncertain) return "BLOCKED";
  if (issues.some((i) => i.severity === "CRITICAL" && !i.recovered)) return "BLOCKED";
  if (issues.some((i) => !i.recovered)) return "WARNING";
  return "OK";
}
