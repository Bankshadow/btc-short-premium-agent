import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { updateDecisionLogEntry } from "@/lib/journal/decision-log";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import { buildOrderTicket } from "./build-order-ticket";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";
import { runPreTradeChecklist } from "./pre-trade-checklist";
import type {
  OrderTicket,
  TradeControlActionLog,
  TradeControlState,
} from "./trade-control-types";

export function attachTradeControlToEntry(
  entry: DecisionLogEntry,
  data: AnalyzeApiResponse,
  allEntries: DecisionLogEntry[],
): DecisionLogEntry | null {
  if (preMortemBlocksTicket(entry.preMortem ?? data.preMortem)) return null;

  const ticket = buildOrderTicket(data, entry.id, entry);
  if (!ticket) return null;

  const checklist = runPreTradeChecklist({
    data,
    ticket,
    entries: allEntries,
  });

  const tradeControl: TradeControlState = {
    status: "PENDING",
    checklist,
    actions: [],
  };

  const entries = updateDecisionLogEntry(entry.id, (e) => ({
    ...e,
    orderTicket: ticket,
    tradeControl,
  }));

  return entries.find((e) => e.id === entry.id) ?? null;
}

export function appendTradeControlAction(
  logEntryId: string,
  action: TradeControlActionLog,
  patch: {
    status: TradeControlState["status"];
    lastExecutionMode?: TradeControlState["lastExecutionMode"];
    livePlaceholderNote?: string;
    ticket?: OrderTicket;
  },
): DecisionLogEntry | null {
  let updated: DecisionLogEntry | undefined;

  updateDecisionLogEntry(logEntryId, (e) => {
    const prev = e.tradeControl ?? {
      status: "PENDING",
      checklist: { allPassed: false, items: [], blockedReason: null },
      actions: [],
    };
    const next: TradeControlState = {
      ...prev,
      status: patch.status,
      actions: [action, ...prev.actions].slice(0, 20),
      lastExecutionMode: patch.lastExecutionMode ?? prev.lastExecutionMode,
      livePlaceholderNote: patch.livePlaceholderNote ?? prev.livePlaceholderNote,
    };
    updated = {
      ...e,
      orderTicket: patch.ticket ?? e.orderTicket,
      tradeControl: next,
    };
    return updated;
  });

  return updated ?? null;
}
