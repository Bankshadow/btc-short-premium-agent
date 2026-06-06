import {
  resolveDecisionOutcome,
  updateDecisionLogEntry,
} from "@/lib/journal/decision-log";
import type { OutcomeLabel, ResolveOutcomeInput } from "@/lib/journal/decision-log-types";
import { tradeWouldWinFromPnl } from "@/lib/paper/paper-pnl-engine";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { allowMockFallbackInCurrentMode } from "@/lib/trading-os/trading-os-runtime";
import {
  findLifecycleByTradeId,
  loadPaperLifecycleRecords,
  transitionLifecycle,
} from "./lifecycle-store";
import type { PaperAutopilotSettings, PaperLifecycleRecord } from "./types";

function computeRMultiple(pnlPct: number, sizePct: number): number {
  const riskUnit = Math.max(0.5, sizePct * 0.5);
  return Number((pnlPct / riskUnit).toFixed(2));
}

export function getPendingResolutionQueue(): PaperLifecycleRecord[] {
  return loadPaperLifecycleRecords().filter(
    (r) => r.status === "CLOSED" && !r.resolvedAt,
  );
}

export function resolveLifecycleNow(
  lifecycleId: string,
  input: ResolveOutcomeInput,
): PaperLifecycleRecord | null {
  const record = loadPaperLifecycleRecords().find((r) => r.lifecycleId === lifecycleId);
  if (!record || record.status !== "CLOSED") return null;

  const order = loadPaperOrders().find((o) => o.id === record.tradeId);
  const pnl =
    input.manualPnlPct ??
    record.realizedPnlPct ??
    order?.realizedPnlPct ??
    0;
  const outcomeLabel: OutcomeLabel =
    input.outcomeLabel ??
    (input.tradeWouldWin === true
      ? "WIN"
      : input.tradeWouldWin === false
        ? "LOSS"
        : "BREAKEVEN");

  const result = resolveDecisionOutcome(record.decisionLogId, {
    ...input,
    outcomeLabel,
    manualPnlPct: pnl,
    notes: input.notes.trim() || "Resolved via paper autopilot.",
  }, { evaluationSource: "paper_autopilot_resolve" });

  if (!result) return null;

  updateDecisionLogEntry(record.decisionLogId, (e) => ({
    ...e,
    paperPnl: pnl,
  }));

  const rMultiple = computeRMultiple(pnl, order?.sizePct ?? 1);
  return (
    transitionLifecycle(lifecycleId, "RESOLVED", `Resolved: ${outcomeLabel}`, {
      outcomeLabel,
      realizedPnlPct: pnl,
      rMultiple,
      resolutionNotes: input.notes.trim(),
      resolvedAt: new Date().toISOString(),
    }) ?? null
  );
}

export function tryAutoResolveDemoLifecycle(
  lifecycleId: string,
  settings: PaperAutopilotSettings,
): PaperLifecycleRecord | null {
  if (!settings.autoResolveEnabled) return null;
  if (!allowMockFallbackInCurrentMode()) return null;

  const record = loadPaperLifecycleRecords().find((r) => r.lifecycleId === lifecycleId);
  if (!record || record.status !== "CLOSED") return null;

  const order = loadPaperOrders().find((o) => o.id === record.tradeId);
  const pnl = record.realizedPnlPct ?? order?.realizedPnlPct ?? 0;
  const win = tradeWouldWinFromPnl(pnl);

  return resolveLifecycleNow(lifecycleId, {
    btcPriceAfter: order?.exitBtcPrice ?? order?.entryBtcPrice ?? 0,
    tradeWouldWin: win,
    outcomeLabel: win ? "WIN" : pnl < -0.05 ? "LOSS" : "BREAKEVEN",
    manualPnlPct: pnl,
    notes: "Demo/local auto-resolution (paper autopilot).",
  });
}

export function processPendingAutoResolutions(
  settings: PaperAutopilotSettings,
): number {
  let resolved = 0;
  for (const pending of getPendingResolutionQueue()) {
    const done = tryAutoResolveDemoLifecycle(pending.lifecycleId, settings);
    if (done) resolved += 1;
  }
  return resolved;
}

export function getLifecycleForTrade(tradeId: string): PaperLifecycleRecord | null {
  return findLifecycleByTradeId(tradeId);
}
