import type { PerpDirectionalSignal } from "@/lib/multi-asset/types";
import type {
  AutomationAction,
  DeskAutomationResult,
} from "./automation-types";

function action(
  partial: Omit<AutomationAction, "id"> & { id?: string },
): AutomationAction {
  return {
    id: partial.id ?? `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...partial,
  };
}

export function deriveAutomationActions(
  result: Omit<DeskAutomationResult, "actions" | "summary" | "aiBrief">,
): AutomationAction[] {
  const actions: AutomationAction[] = [];

  const actionableSignals =
    result.assets?.signals.filter((s) => s.actionable) ?? [];
  for (const signal of actionableSignals) {
    actions.push(
      action({
        type: "OPEN_PAPER_PERP",
        priority: signal.confidence === "HIGH" ? "HIGH" : "MEDIUM",
        module: "assets",
        title: `Open paper ${signal.direction} ${signal.label}`,
        detail: `Score ${signal.score} · size ${signal.suggestedSizePct}%`,
        autoApplicable: true,
        payload: { signal },
      }),
    );
  }

  const analyze = result.analyze;
  if (analyze) {
    const verdict =
      analyze.finalVerdict ??
      analyze.tradingDesk?.committee.finalVerdict ??
      "WAIT";
    const blocked = analyze.conflictGate?.tradeBlocked ?? false;
    if (verdict === "TRADE" && !blocked) {
      actions.push(
        action({
          type: "REVIEW_BTC_TRADE",
          priority: "HIGH",
          module: "analyze",
          title: "BTC desk TRADE — review trade control",
          detail: analyze.tradingDesk?.committee.finalActionPlan ?? "Committee TRADE",
          autoApplicable: false,
          payload: { verdict, analyzedAt: analyze.step5_verdict?.analyzedAt },
        }),
      );
    }
  }

  const proposals = result.council?.proposals ?? [];
  for (const p of proposals.slice(0, 3)) {
    if (p.status === "DRAFT" && p.testMode === "paper_only") {
      actions.push(
        action({
          type: "COUNCIL_PROPOSAL",
          priority: "MEDIUM",
          module: "council",
          title: `Council: ${p.title}`,
          detail: p.proposedChange,
          autoApplicable: false,
          payload: { proposalId: p.id },
        }),
      );
    }
  }

  if (result.simulation && !result.simulation.aggressiveModeSafe) {
    actions.push(
      action({
        type: "LOWER_RISK",
        priority: "HIGH",
        module: "simulation",
        title: "Lower risk — simulation blocked aggressive mode",
        detail: `Ruin est. high · recommended risk ${result.simulation.recommendedRiskPct}%`,
        autoApplicable: false,
        payload: { recommendedRiskPct: result.simulation.recommendedRiskPct },
      }),
    );
  }

  if (result.warRoom?.recommendedAction.includes("safe")) {
    actions.push(
      action({
        type: "ENABLE_SAFE_MODE",
        priority: "HIGH",
        module: "war_room",
        title: "War room suggests safe mode",
        detail: result.warRoom.recommendedAction,
        autoApplicable: false,
        payload: { scenarioId: result.warRoom.scenarioId },
      }),
    );
  }

  if (result.frequency && !result.frequency.frequencyAllowed) {
    actions.push(
      action({
        type: "PAUSE_PAPER_AUTO",
        priority: "HIGH",
        module: "frequency",
        title: "Pause new trades — frequency limit",
        detail: result.frequency.reason ?? "Cooldown active",
        autoApplicable: true,
      }),
    );
  }

  if (result.mortem && result.mortem.regretScore > 40) {
    actions.push(
      action({
        type: "REGRET_REVIEW",
        priority: "MEDIUM",
        module: "mortem",
        title: "High regret score — review mortem",
        detail: `Regret ${result.mortem.regretScore} · false trades ${result.mortem.falseTrade}`,
        autoApplicable: false,
      }),
    );
  }

  if (result.operator && result.operator.disciplineScore < 55) {
    actions.push(
      action({
        type: "OPERATOR_COOLDOWN",
        priority: "MEDIUM",
        module: "operator",
        title: "Operator discipline low",
        detail: `Score ${result.operator.disciplineScore} (${result.operator.grade})`,
        autoApplicable: false,
      }),
    );
  }

  for (const signal of actionableSignals) {
    if (result.exchange?.configured && result.exchange.connected) {
      actions.push(
        action({
          type: "LIVE_PERP_EXECUTE",
          priority: "LOW",
          module: "exchange",
          title: `Live-ready ${signal.symbol} (human confirm required)`,
          detail: "Preview + double confirm on /assets",
          autoApplicable: false,
          payload: { signal: signal as PerpDirectionalSignal },
        }),
      );
    }
  }

  return actions.sort((a, b) => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return rank[a.priority] - rank[b.priority];
  });
}

export function buildAutomationSummary(
  actions: AutomationAction[],
  result: Pick<DeskAutomationResult, "modulesRun" | "meta">,
): { summary: string; aiBrief: string } {
  const errors = result.modulesRun.filter((m) => result.meta[m]?.ok === false);
  const autoCount = actions.filter((a) => a.autoApplicable).length;
  const summary = [
    `Ran ${result.modulesRun.length} modules`,
    errors.length ? `${errors.length} errors` : "all ok",
    `${actions.length} actions (${autoCount} auto-apply)`,
  ].join(" · ");

  const lines = actions.slice(0, 8).map((a) => `[${a.priority}] ${a.title}: ${a.detail}`);
  const aiBrief = [
    "Desk automation cycle complete.",
    summary,
    lines.length ? "Top actions:\n" + lines.join("\n") : "No immediate actions.",
    "Paper auto-apply runs on client when enabled. Live orders require human double-confirm.",
  ].join("\n");

  return { summary, aiBrief };
}
