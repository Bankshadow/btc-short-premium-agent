import type { AgentOutput, AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry, OutcomeLabel } from "@/lib/journal/decision-log-types";
import {
  DECISION_LOG_STORAGE_KEY,
  persistDecisionLog,
} from "@/lib/journal/decision-log";
import { persistPaperOrders } from "@/lib/paper/paper-orders";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  PAPER_ACCOUNT_NOTIONAL_USD,
  PAPER_ORDERS_STORAGE_KEY,
} from "@/lib/paper/paper-order-types";
import { allowMockFallbackInCurrentMode } from "@/lib/trading-os/trading-os-runtime";

export const DEMO_SEED_LABEL = "DEMO";

const VERDICTS: AgentRecommendation[] = ["TRADE", "WAIT", "SKIP"];
const REGIMES = ["Bearish premium", "Range-bound", "Bull trap risk"];
const OUTCOMES: OutcomeLabel[] = ["WIN", "LOSS", "BREAKEVEN", "WIN", "LOSS"];

function stubAgent(verdict: AgentRecommendation): AgentOutput {
  return {
    agentName: "Options Agent",
    strategyType: "OPTIONS",
    recommendation: verdict,
    confidence: "MEDIUM",
    marketView: "Demo seed",
    reasons: ["Demo seed agent output"],
    risks: ["Demo data only"],
    proposedAction: "none",
    missingData: [],
  };
}

function buildDemoEntry(i: number, baseBtc: number): DecisionLogEntry {
  const verdict = VERDICTS[i % VERDICTS.length];
  const outcome = OUTCOMES[i % OUTCOMES.length];
  const win = outcome === "WIN";
  const loss = outcome === "LOSS";
  const move = win ? 0.012 : loss ? -0.009 : 0;
  const entryBtc = baseBtc + i * 120;
  const exitBtc = Math.round(entryBtc * (1 + move));
  const pnl = win ? 1.2 : loss ? -0.9 : 0;
  const ts = new Date(Date.now() - (20 - i) * 86_400_000).toISOString();
  const id = `demo-log-${i}-${Date.now()}`;

  return {
    id,
    runId: `demo-run-${i}`,
    analyzeStatus: "DEMO",
    isDemoData: true,
    timestamp: ts,
    btcPrice: entryBtc,
    marketRegime: REGIMES[i % REGIMES.length],
    deskRiskProfile: "balanced",
    agentOutputs: [stubAgent(verdict)],
    finalVerdict: verdict,
    riskVeto: false,
    topReasons: [`${DEMO_SEED_LABEL} seed outcome ${i + 1}`],
    actionPlan: "Demo paper cycle — not counted toward live readiness.",
    outcomeStatus: "RESOLVED",
    paperPnl: pnl,
    reflection: {
      whatWasCorrect: win ? ["Demo: regime read aligned"] : [],
      whatWasWrong: loss ? ["Demo: sizing too aggressive"] : [],
      tooAggressiveAgents: loss ? ["options"] : [],
      helpfulRiskRules: ["Demo risk gate"],
      suggestedDraftRule:
        i % 5 === 0
          ? "Demo draft: require IV rank > 50 before short premium."
          : "",
      generatedAt: ts,
    },
    resolution: {
      btcPriceAfter: exitBtc,
      tradeWouldWin: win ? true : loss ? false : null,
      outcomeLabel: outcome,
      manualPnlPct: pnl,
      notes: `${DEMO_SEED_LABEL} resolved paper outcome`,
      resolvedAt: ts,
    },
  };
}

function buildDemoOrder(entry: DecisionLogEntry, i: number): PaperOrder {
  const isShadow = entry.finalVerdict !== "TRADE";
  const pnl = entry.paperPnl ?? 0;
  return {
    id: `demo-order-${i}`,
    decisionLogId: entry.id,
    committeeVerdict: entry.finalVerdict,
    instrument: isShadow ? "no_trade" : "sell_call",
    symbol: "BTCUSDT",
    side: isShadow ? "none" : "short",
    entryBtcPrice: entry.btcPrice,
    entryOptionMark: isShadow ? null : 420,
    strike: isShadow ? null : entry.btcPrice + 2500,
    sizePct: 1,
    notionalUsd: PAPER_ACCOUNT_NOTIONAL_USD * 0.01,
    status: "CLOSED",
    openedAt: entry.timestamp,
    closedAt: entry.resolution?.resolvedAt ?? entry.timestamp,
    exitBtcPrice: entry.resolution?.btcPriceAfter ?? entry.btcPrice,
    realizedPnlPct: pnl,
    unrealizedPnlPct: null,
    lastMarkAt: entry.resolution?.resolvedAt ?? entry.timestamp,
    lastMarkBtcPrice: entry.resolution?.btcPriceAfter ?? entry.btcPrice,
    openedBy: isShadow ? "relaxed_auto" : "committee_auto",
    notes: `${DEMO_SEED_LABEL} seed trade`,
    paperMode: isShadow ? "RELAXED_PAPER" : "STRICT_PAPER",
    isDemoData: true,
  };
}

export function isDemoSeedAllowed(): boolean {
  return allowMockFallbackInCurrentMode();
}

export function hasDemoSeedData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DECISION_LOG_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as DecisionLogEntry[];
    return Array.isArray(parsed) && parsed.some((e) => e.isDemoData);
  } catch {
    return false;
  }
}

export function seedDemoDeskData(count = 20): {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
} {
  if (!isDemoSeedAllowed()) {
    throw new Error("Demo seed is only available in demo/local mode.");
  }

  const baseBtc = 96_000;
  const entries = Array.from({ length: count }, (_, i) =>
    buildDemoEntry(i, baseBtc),
  );
  const orders = entries.map((e, i) => buildDemoOrder(e, i));

  const existingEntries = JSON.parse(
    localStorage.getItem(DECISION_LOG_STORAGE_KEY) ?? "[]",
  ) as DecisionLogEntry[];
  const existingOrders = JSON.parse(
    localStorage.getItem(PAPER_ORDERS_STORAGE_KEY) ?? "[]",
  ) as PaperOrder[];

  const withoutDemoEntries = existingEntries.filter((e) => !e.isDemoData);
  const withoutDemoOrders = existingOrders.filter((o) => !o.isDemoData);

  persistDecisionLog([...entries, ...withoutDemoEntries]);
  persistPaperOrders([...orders, ...withoutDemoOrders]);

  return { entries, orders };
}

export function clearDemoDeskData(): void {
  if (typeof window === "undefined") return;
  try {
    const entries = JSON.parse(
      localStorage.getItem(DECISION_LOG_STORAGE_KEY) ?? "[]",
    ) as DecisionLogEntry[];
    const orders = JSON.parse(
      localStorage.getItem(PAPER_ORDERS_STORAGE_KEY) ?? "[]",
    ) as PaperOrder[];
    persistDecisionLog(entries.filter((e) => !e.isDemoData));
    persistPaperOrders(orders.filter((o) => !o.isDemoData));
  } catch {
    /* ignore */
  }
}
