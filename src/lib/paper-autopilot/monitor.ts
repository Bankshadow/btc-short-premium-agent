import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { computeUnrealizedPnlPct } from "@/lib/paper/paper-pnl-engine";
import { transitionLifecycle, updateLifecycle } from "./lifecycle-store";
import type {
  PaperAutopilotSettings,
  PaperLifecycleRecord,
  PaperMonitorSignal,
} from "./types";

function committeeVerdict(data: AnalyzeApiResponse): string {
  return String(
    data.tradingDesk?.committee.finalVerdict ?? data.step5_verdict.recommendation,
  ).toUpperCase();
}

function thesisInvalidated(data: AnalyzeApiResponse): string | null {
  if (data.dataTrust?.grade === "CRITICAL") {
    return data.dataTrust.criticalIssues[0] ?? "Data trust CRITICAL.";
  }
  const triggers = data.preMortem?.invalidationTriggers ?? [];
  if (triggers.length > 0 && data.preMortem?.preMortemVerdict === "CAUTION") {
    return triggers[0];
  }
  return null;
}

export function monitorOpenLifecycle(
  record: PaperLifecycleRecord,
  order: PaperOrder,
  btcPrice: number,
  settings: PaperAutopilotSettings,
  latestAnalysis?: AnalyzeApiResponse | null,
): { record: PaperLifecycleRecord; signals: PaperMonitorSignal[] } {
  const signals: PaperMonitorSignal[] = [];

  if (order.status !== "OPEN" || btcPrice <= 0) {
    return { record, signals };
  }

  const pnl = computeUnrealizedPnlPct(order, btcPrice);
  signals.push({
    lifecycleId: record.lifecycleId,
    tradeId: order.id,
    signal: "MARK_UPDATE",
    detail: `Mark ${btcPrice.toLocaleString()} · uPnL ${pnl >= 0 ? "+" : ""}${pnl}%`,
    recommendClose: false,
  });

  let next = record;
  if (record.status === "OPEN") {
    next =
      transitionLifecycle(record.lifecycleId, "MONITORING", "Monitoring active.", {
        markBtcPrice: btcPrice,
        unrealizedPnlPct: pnl,
      }) ?? record;
  } else if (record.status === "MONITORING" || record.status === "CLOSE_RECOMMENDED") {
    next =
      updateLifecycle(record.lifecycleId, (r) => ({
        ...r,
        markBtcPrice: btcPrice,
        unrealizedPnlPct: pnl,
        updatedAt: new Date().toISOString(),
      })) ?? record;
  }

  if (pnl <= settings.stopLossPct) {
    signals.push({
      lifecycleId: record.lifecycleId,
      tradeId: order.id,
      signal: "SL_HIT",
      detail: `Stop loss ${settings.stopLossPct}% hit (uPnL ${pnl}%).`,
      recommendClose: true,
    });
  }

  if (pnl >= settings.takeProfitPct) {
    signals.push({
      lifecycleId: record.lifecycleId,
      tradeId: order.id,
      signal: "TP_HIT",
      detail: `Take profit ${settings.takeProfitPct}% hit (uPnL ${pnl}%).`,
      recommendClose: true,
    });
  }

  if (latestAnalysis) {
    const verdict = committeeVerdict(latestAnalysis);
    const openedVerdict = String(order.committeeVerdict).toUpperCase();
    if (
      openedVerdict === "TRADE" &&
      (verdict === "SKIP" || verdict === "WAIT") &&
      order.paperMode !== "RELAXED_PAPER"
    ) {
      signals.push({
        lifecycleId: record.lifecycleId,
        tradeId: order.id,
        signal: "VERDICT_FLIP",
        detail: `Committee flipped ${openedVerdict} → ${verdict}.`,
        recommendClose: true,
      });
    }
  }

  const invalid = latestAnalysis ? thesisInvalidated(latestAnalysis) : null;
  if (invalid) {
    signals.push({
      lifecycleId: record.lifecycleId,
      tradeId: order.id,
      signal: "THESIS_INVALID",
      detail: invalid,
      recommendClose: true,
    });
  }

  const shouldRecommend = signals.some((s) => s.recommendClose);
  if (shouldRecommend && next.status !== "CLOSE_RECOMMENDED" && next.status !== "CLOSED") {
    const reason = signals
      .filter((s) => s.recommendClose)
      .map((s) => s.detail)
      .join(" · ");
    next =
      transitionLifecycle(next.lifecycleId, "CLOSE_RECOMMENDED", reason, {
        closeRecommendation: reason,
        monitorNotes: [...next.monitorNotes, reason].slice(-8),
      }) ?? next;
  }

  return { record: next, signals };
}
