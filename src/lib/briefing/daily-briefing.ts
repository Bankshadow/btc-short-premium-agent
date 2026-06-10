import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newBriefingId } from "@/lib/journal/journal-types";
import { resolveTestnetConnectionStatus } from "@/lib/execution/testnet-status";
import { ZERO_STATE_NEXT_ACTION } from "@/lib/core/zero-state";
import { getAllLearningRecords, summarizeLearning } from "@/lib/learning/learning-store";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { getOperatorStatus } from "@/lib/operator/operator-actions";
import { getTradesSummary } from "@/lib/trades/trade-query";
import type { DailyBriefing } from "./briefing-types";

function binanceStatusFromConnection(testnet: Awaited<ReturnType<typeof resolveTestnetConnectionStatus>>): string {
  if (testnet.connected) return "CONNECTED";
  if (!testnet.configured) return "MISSING_ENV";
  return "DISCONNECTED";
}

export async function createDailyBriefing(): Promise<DailyBriefing> {
  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const trades = await getTradesSummary();
  const operator = await getOperatorStatus();
  const learning = summarizeLearning(await getAllLearningRecords());
  const testnet = await resolveTestnetConnectionStatus();
  const operatorEvents = events
    .filter((e) => e.type === "OPERATOR_ACTION_RECORDED")
    .slice(-5)
    .map((e) => String((e.payload as { action?: string }).action ?? e.type));

  let nextAction = ZERO_STATE_NEXT_ACTION;
  if (operator.killSwitchActive) nextAction = "Kill switch active — resolve before trading.";
  else if (operator.engineState === "PAUSED") nextAction = "Engine paused — resume when ready.";
  else if (trades.open.length > 0) nextAction = "Monitor open position and review close when ready.";
  else if (mission.latestVerdict === "TRADE") nextAction = "TRADE verdict — run safety review.";
  else nextAction = "Run analysis cycle or review reports.";

  const briefing: DailyBriefing = {
    briefingId: newBriefingId(),
    createdAt: new Date().toISOString(),
    mission,
    binanceStatus: binanceStatusFromConnection(testnet),
    openPositionsCount: trades.summary.openCount,
    closedTradesCount: trades.summary.closedCount,
    totalNetPnl: trades.summary.realizedPnl,
    learningHighlights: learning.latestLessons.map((l) => l.lesson).slice(0, 5),
    riskState: `${operator.riskMode} · kill ${operator.killSwitchActive ? "ON" : "OFF"}`,
    operatorActions: operatorEvents,
    nextRecommendedAction: nextAction,
    liveLocked: true,
  };

  await appendEvent({
    type: "DAILY_BRIEFING_CREATED",
    environment: "testnet",
    payload: { ...briefing },
  });

  return briefing;
}

export async function getLatestBriefing(): Promise<DailyBriefing | null> {
  const events = await getEvents();
  const evt = [...events]
    .filter((e) => e.type === "DAILY_BRIEFING_CREATED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!evt) return null;
  return evt.payload as unknown as DailyBriefing;
}
