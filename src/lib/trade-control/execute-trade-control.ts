import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  buildPaperOrderFromAnalysis,
  tryAutoClosePaperOnSkip,
} from "@/lib/paper/paper-execution";
import {
  savePaperOrder,
  loadPaperSettings,
} from "@/lib/paper/paper-orders";
import { PAPER_ACCOUNT_NOTIONAL_USD } from "@/lib/paper/paper-order-types";
import { syncOpenedPaperOrder } from "@/lib/paper/paper-sync";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { formatTicketForCopy } from "./build-order-ticket";
import { appendTradeControlAction } from "./trade-control-log";
import { runPreTradeChecklist } from "./pre-trade-checklist";
import type {
  ExecutionMode,
  OrderTicket,
  TradeControlActionType,
} from "./trade-control-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { getTradingOsModeEffects } from "@/lib/trading-os/trading-os-runtime";
import { isRelaxedPaperMode } from "@/lib/paper/paper-relaxed-gate";

export interface ExecuteTradeControlInput {
  action: TradeControlActionType;
  executionMode: ExecutionMode;
  operatorNote: string;
  logEntryId: string;
  data: AnalyzeApiResponse;
  ticket: OrderTicket;
  entries: DecisionLogEntry[];
  modifiedTicket?: Partial<OrderTicket>;
}

export interface ExecuteTradeControlResult {
  ok: boolean;
  error?: string;
  copyText?: string;
  paperOrder?: PaperOrder;
  livePlaceholder?: string;
  updatedEntry?: DecisionLogEntry;
}

function requireNote(
  action: TradeControlActionType,
  note: string,
): string | null {
  if (action === "REJECT" || action === "MODIFY") {
    if (!note.trim()) return "Operator note required for Reject or Modify.";
  }
  if (action === "APPROVE" && note.length === 0) {
    return null;
  }
  return null;
}

function saveOperatorApprovedPaper(
  data: AnalyzeApiResponse,
  logEntryId: string,
  ticket: OrderTicket,
  notes: string,
): PaperOrder | null {
  const base = buildPaperOrderFromAnalysis(data, logEntryId);
  if (!base) return null;

  const order: PaperOrder = {
    ...base,
    sizePct: ticket.positionSizePct,
    notionalUsd: PAPER_ACCOUNT_NOTIONAL_USD * (ticket.positionSizePct / 100),
    openedBy: "operator_approved",
    notes: notes.trim() || base.notes,
  };
  savePaperOrder(order);
  return order;
}

export async function executeTradeControl(
  input: ExecuteTradeControlInput,
): Promise<ExecuteTradeControlResult> {
  const noteError = requireNote(input.action, input.operatorNote);
  if (noteError) return { ok: false, error: noteError };

  let ticket: OrderTicket = {
    ...input.ticket,
    ...input.modifiedTicket,
  };

  if (input.action === "MODIFY" && input.modifiedTicket) {
    ticket = { ...ticket, ...input.modifiedTicket };
    const log = appendTradeControlAction(
      input.logEntryId,
      {
        action: "MODIFY",
        executionMode: input.executionMode,
        operatorNote: input.operatorNote.trim(),
        timestamp: new Date().toISOString(),
        ticketPatch: input.modifiedTicket,
      },
      { status: "MODIFIED", ticket },
    );
    return {
      ok: true,
      updatedEntry: log ?? undefined,
      copyText: formatTicketForCopy(ticket),
    };
  }

  if (input.action === "REJECT") {
    const log = appendTradeControlAction(
      input.logEntryId,
      {
        action: "REJECT",
        executionMode: input.executionMode,
        operatorNote: input.operatorNote.trim(),
        timestamp: new Date().toISOString(),
      },
      { status: "REJECTED" },
    );
    tryAutoClosePaperOnSkip(input.data, "SKIP");
    return { ok: true, updatedEntry: log ?? undefined };
  }

  const checklist = runPreTradeChecklist({
    data: input.data,
    ticket,
    entries: input.entries,
  });
  if (!checklist.allPassed) {
    return {
      ok: false,
      error: `Pre-trade checklist failed: ${checklist.blockedReason}`,
    };
  }

  const mode = input.executionMode;
  const note = input.operatorNote.trim();

  if (input.action === "PAPER_ONLY") {
    const order = saveOperatorApprovedPaper(
      input.data,
      input.logEntryId,
      ticket,
      `[PAPER_ONLY] ${note}`,
    );
    const log = appendTradeControlAction(
      input.logEntryId,
      {
        action: "PAPER_ONLY",
        executionMode: "PAPER_EXECUTE",
        operatorNote: note || "Paper only — no live path",
        timestamp: new Date().toISOString(),
      },
      { status: "PAPER_ONLY", lastExecutionMode: "PAPER_EXECUTE" },
    );
    if (order && loadPaperSettings().syncSupabase) {
      await syncOpenedPaperOrder(order, loadPaperSettings());
    }
    return { ok: true, paperOrder: order ?? undefined, updatedEntry: log ?? undefined };
  }

  if (input.action === "APPROVE") {
    if (
      isRelaxedPaperMode(loadPaperSettings()) &&
      mode === "MANUAL_APPROVED_LIVE_PLACEHOLDER"
    ) {
      return {
        ok: false,
        error:
          "Relaxed paper learning mode — live execution paths are blocked.",
      };
    }

    if (mode === "COPY_ONLY") {
      const log = appendTradeControlAction(
        input.logEntryId,
        {
          action: "APPROVE",
          executionMode: mode,
          operatorNote: note || "Approved — copy only",
          timestamp: new Date().toISOString(),
        },
        { status: "APPROVED", lastExecutionMode: mode },
      );
      return {
        ok: true,
        copyText: formatTicketForCopy(ticket),
        updatedEntry: log ?? undefined,
      };
    }

    if (mode === "MANUAL_APPROVED_LIVE_PLACEHOLDER") {
      if (!getTradingOsModeEffects().allowLivePlaceholder) {
        return { ok: false, error: "Live placeholder not allowed in current environment mode." };
      }
      const placeholder = [
        "MANUAL_APPROVED_LIVE_PLACEHOLDER",
        "No exchange API connected.",
        "Operator would place live order manually off-desk.",
        formatTicketForCopy(ticket),
      ].join("\n\n");
      const log = appendTradeControlAction(
        input.logEntryId,
        {
          action: "APPROVE",
          executionMode: mode,
          operatorNote: note || "Live placeholder — human places order externally",
          timestamp: new Date().toISOString(),
        },
        {
          status: "APPROVED",
          lastExecutionMode: mode,
          livePlaceholderNote: placeholder,
        },
      );
      return {
        ok: true,
        livePlaceholder: placeholder,
        copyText: formatTicketForCopy(ticket),
        updatedEntry: log ?? undefined,
      };
    }

    if (mode === "PAPER_EXECUTE") {
      const order = saveOperatorApprovedPaper(
        input.data,
        input.logEntryId,
        ticket,
        note || "Operator approved — paper execute",
      );
      if (!order) {
        return { ok: false, error: "Could not build paper order." };
      }
      const log = appendTradeControlAction(
        input.logEntryId,
        {
          action: "APPROVE",
          executionMode: mode,
          operatorNote: note || "Approved — paper execute",
          timestamp: new Date().toISOString(),
        },
        { status: "APPROVED", lastExecutionMode: mode },
      );
      if (loadPaperSettings().syncSupabase) {
        await syncOpenedPaperOrder(order, loadPaperSettings());
      }
      return {
        ok: true,
        paperOrder: order,
        updatedEntry: log ?? undefined,
      };
    }
  }

  return { ok: false, error: "Unknown action or mode." };
}
