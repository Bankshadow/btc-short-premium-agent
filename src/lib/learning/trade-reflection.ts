import type { RealizedPnlRecord } from "@/lib/pnl/pnl-types";
import type { JournalEvent } from "@/lib/journal/journal-types";

export function buildTradeReflection(input: {
  pnl: RealizedPnlRecord;
  verdict: string | null;
  verdictReasons: string[];
}) {
  const thesis = input.verdict
    ? `${input.verdict} — ${input.verdictReasons.slice(0, 2).join("; ") || "no reasons recorded"}`
    : "No verdict recorded for this trade.";

  const actualOutcome =
    input.pnl.result === "WIN"
      ? `Profitable close with net PnL $${input.pnl.netPnl.toFixed(4)}.`
      : input.pnl.result === "LOSS"
        ? `Loss on close with net PnL $${input.pnl.netPnl.toFixed(4)}.`
        : `Breakeven close with net PnL ~$${input.pnl.netPnl.toFixed(4)}.`;

  const whatWorked =
    input.pnl.result === "WIN"
      ? "Thesis aligned with outcome; reduce-only close preserved capital discipline."
      : input.pnl.result === "BREAKEVEN"
        ? "Execution and close process completed without slippage disaster."
        : "Process completed — review thesis and timing.";

  const whatFailed =
    input.pnl.result === "LOSS"
      ? "Trade thesis did not match market outcome; review entry timing and regime."
      : input.pnl.result === "WIN"
        ? "Nothing critical — capture what setup worked."
        : "Edge was insufficient for meaningful profit after fees.";

  return {
    originalThesis: thesis,
    actualOutcome,
    whatWorked,
    whatFailed,
    riskNotes: "Testnet only — live locked. Risk gate and double confirm were required.",
    executionNotes: "Manual testnet execution with safety gate and reduce-only close.",
    avoidNextTime:
      input.pnl.result === "LOSS"
        ? "Avoid repeating same setup without updated evidence."
        : "Do not skip position refresh before close.",
    repeatNextTime:
      input.pnl.result === "WIN"
        ? "Repeat setup tagging and evidence collection for this pattern."
        : "Repeat disciplined close process only.",
    confidenceAdjustment: input.pnl.result === "WIN" ? 0.05 : input.pnl.result === "LOSS" ? -0.05 : 0,
  };
}

export function findVerdictForTrade(tradeId: string, events: JournalEvent[]) {
  const order = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  if (!order?.decisionLogId) return { verdict: null, reasons: [] as string[] };
  const verdictEvt = events.find(
    (e) => e.type === "VERDICT_CREATED" && e.decisionLogId === order.decisionLogId,
  );
  const payload = verdictEvt?.payload as { verdict?: string; reasons?: string[] } | undefined;
  return { verdict: payload?.verdict ?? null, reasons: payload?.reasons ?? [] };
}
