import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import type { OperatorAction, OperatorActionType } from "./types";

function action(
  partial: Omit<OperatorAction, "status" | "createdAt"> & { createdAt?: string },
): OperatorAction {
  return {
    ...partial,
    status: partial.type === "NO_ACTION" ? "DONE" : "OPEN",
    createdAt: partial.createdAt ?? new Date().toISOString(),
  };
}

export function buildOperatorActionQueue(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  latestAnalysis?: AnalyzeApiResponse | null;
  serverContext?: ServerReadinessContext;
  commandBlockers?: string[];
}): OperatorAction[] {
  const actions: OperatorAction[] = [];
  const ts = new Date().toISOString();
  const resolved = input.entries.filter((e) => e.outcomeStatus === "RESOLVED");
  const pending = input.entries.filter((e) => e.outcomeStatus === "PENDING");
  const openPaper = input.orders.filter((o) => o.status === "OPEN");
  const server = input.serverContext;

  if (input.entries.length === 0 || !input.latestAnalysis) {
    actions.push(
      action({
        actionId: `oa-run-analysis-${ts}`,
        type: "RUN_ANALYSIS",
        priority: "HIGH",
        title: "Run first desk cycle",
        description:
          "No learning data yet. Run the first desk cycle to start building trade memory.",
        reason: "No decision logs or analyze snapshot.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "autopilot",
        requiresHumanApproval: false,
      }),
    );
  }

  if (pending.length > 0) {
    const top = pending[0];
    actions.push(
      action({
        actionId: `oa-resolve-${top.id}`,
        type: "RESOLVE_OUTCOME",
        priority: "HIGH",
        title: "Resolve pending outcome",
        description: `Close the loop on ${top.finalVerdict} verdict from ${new Date(top.timestamp).toLocaleString()}.`,
        reason: `${pending.length} decision log(s) awaiting resolution.`,
        linkedDecisionLogId: top.id,
        linkedTradeId: null,
        linkedModule: "journal",
        requiresHumanApproval: true,
      }),
    );
  }

  if (resolved.length === 0 && input.entries.length > 0) {
    actions.push(
      action({
        actionId: `oa-resolve-any-${ts}`,
        type: "RESOLVE_OUTCOME",
        priority: "CRITICAL",
        title: "Start resolving outcomes",
        description:
          "AI is not learning yet — resolve at least one paper outcome to unlock scoreboard and validation.",
        reason: "Zero resolved outcomes.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "learning",
        requiresHumanApproval: true,
      }),
    );
  }

  for (const order of openPaper.slice(0, 2)) {
    actions.push(
      action({
        actionId: `oa-review-paper-${order.id}`,
        type: "REVIEW_PAPER_TRADE",
        priority: "MEDIUM",
        title: `Review open paper · ${order.symbol}`,
        description: "Confirm thesis, risk, and exit plan for open paper position.",
        reason: "Open paper trade needs operator awareness.",
        linkedDecisionLogId: order.decisionLogId,
        linkedTradeId: order.id,
        linkedModule: "paper",
        requiresHumanApproval: true,
      }),
    );
  }

  if (server && !server.supabaseConfigured) {
    actions.push(
      action({
        actionId: `oa-enable-sync-${ts}`,
        type: "ENABLE_SYNC",
        priority: "HIGH",
        title: "Enable cloud sync",
        description:
          "Reliability setup incomplete: configure Supabase so journal and trades persist beyond this browser.",
        reason: "Supabase sync off.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "warehouse",
        requiresHumanApproval: true,
      }),
    );
  }

  const anyAlert =
    server &&
    (server.telegramConfigured ||
      server.discordEnvConfigured ||
      server.deskWebhookConfigured);
  if (server && !anyAlert) {
    actions.push(
      action({
        actionId: `oa-configure-alerts-${ts}`,
        type: "CONFIGURE_ALERTS",
        priority: "HIGH",
        title: "Configure alerts",
        description:
          "Reliability setup incomplete: add Telegram or webhook so the desk can reach you on blockers.",
        reason: "Alert channels off.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "alerts",
        requiresHumanApproval: true,
      }),
    );
  }

  const capital = buildCapitalReport({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.latestAnalysis,
  });
  if (!capital.scalePermission.allowed) {
    actions.push(
      action({
        actionId: `oa-capital-blocked-${ts}`,
        type: "REVIEW_RISK_BLOCKER",
        priority: "MEDIUM",
        title: "Capital scaling blocked",
        description:
          capital.scalePermission.blockedReason ??
          "Gather more resolved samples before scaling capital.",
        reason: "Capital scaling blocked.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "capital",
        requiresHumanApproval: true,
      }),
    );
  }

  const totalResolved = resolved.length;
  if (totalResolved < VALIDATION_THRESHOLDS.minSignalsForActive) {
    actions.push(
      action({
        actionId: `oa-sample-size-${ts}`,
        type: "REVIEW_STRATEGY",
        priority: "MEDIUM",
        title: `Need ${VALIDATION_THRESHOLDS.minSignalsForActive} resolved samples`,
        description: `Currently ${totalResolved} resolved — continue paper trading and resolving outcomes.`,
        reason: "Validation sample size below threshold.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "validation",
        requiresHumanApproval: false,
      }),
    );
  }

  if (server && !server.exchangeStatus.configured) {
    actions.push(
      action({
        actionId: `oa-check-exchange-${ts}`,
        type: "CHECK_EXCHANGE",
        priority: "LOW",
        title: "Check exchange connectivity",
        description: "Exchange status unknown — configure credentials when ready for testnet drills.",
        reason: "Exchange not configured.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "exchange",
        requiresHumanApproval: true,
      }),
    );
  }

  for (const blocker of (input.commandBlockers ?? []).slice(0, 2)) {
    actions.push(
      action({
        actionId: `oa-blocker-${actions.length}-${ts}`,
        type: "REVIEW_RISK_BLOCKER",
        priority: "HIGH",
        title: "Review production blocker",
        description: blocker,
        reason: "Command center reality check.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "command_center",
        requiresHumanApproval: true,
      }),
    );
  }

  if (actions.length === 0) {
    actions.push(
      action({
        actionId: `oa-no-action-${ts}`,
        type: "NO_ACTION",
        priority: "LOW",
        title: "No urgent operator actions",
        description: "Desk cycle complete — monitor autopilot and portfolio.",
        reason: "Queue empty.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "autopilot",
        requiresHumanApproval: false,
      }),
    );
  }

  const priorityOrder: Record<OperatorActionType, number> = {
    RUN_ANALYSIS: 0,
    RESOLVE_OUTCOME: 1,
    REVIEW_RISK_BLOCKER: 2,
    CONFIGURE_ALERTS: 3,
    ENABLE_SYNC: 4,
    REVIEW_PAPER_TRADE: 5,
    REVIEW_STRATEGY: 6,
    ENABLE_PAPER_AUTOPILOT: 7,
    OPEN_SHADOW_TRADE: 8,
    CHECK_EXCHANGE: 9,
    APPROVE_RULE: 10,
    REJECT_RULE: 11,
    NO_ACTION: 99,
  };

  const prioRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  return actions
    .filter((a) => a.status === "OPEN")
    .sort(
      (a, b) =>
        prioRank[a.priority] - prioRank[b.priority] ||
        priorityOrder[a.type] - priorityOrder[b.type],
    )
    .slice(0, 12);
}
