import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { loadServerBackboneRecord } from "@/lib/background-worker/server-backbone";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import { getDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { loadMissionRiskSettings } from "@/lib/mission-risk/mission-risk-store";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AutomationRunInput } from "./types";

export interface AutomationServerContext {
  workspaceId: string;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
}

export async function loadAutomationServerContext(
  input: AutomationRunInput = {},
): Promise<AutomationServerContext> {
  await loadMissionRiskSettings().catch(() => undefined);
  const workspaceId = input.workspaceId ?? "server-default";
  const entries =
    input.entries?.length ? input.entries : await loadServerAnalysisJournal();

  let orders = input.orders ?? [];
  if (orders.length === 0) {
    const backbone = await loadServerBackboneRecord();
    if (backbone?.trades?.length) {
      orders = backbone.trades.map((t) => ({
        id: t.tradeId,
        decisionLogId: t.decisionId,
        committeeVerdict: "TRADE" as const,
        instrument: "short_call" as PaperOrder["instrument"],
        symbol: t.instrument,
        side: "short",
        entryBtcPrice: 0,
        entryOptionMark: null,
        strike: null,
        sizePct: 1,
        notionalUsd: t.notionalUsd,
        status: t.status,
        openedAt: t.openedAt,
        closedAt: t.closedAt,
        exitBtcPrice: null,
        realizedPnlPct: t.realizedPnlPct,
        unrealizedPnlPct: null,
        lastMarkAt: null,
        lastMarkBtcPrice: null,
        openedBy: "committee_auto",
        notes: "from-server-backbone",
      })) as PaperOrder[];
    }
  }

  return {
    workspaceId,
    entries,
    orders,
    perpPositions: input.perpPositions ?? [],
    riskProfile: input.riskProfile ?? getDeskRiskProfile(),
  };
}
