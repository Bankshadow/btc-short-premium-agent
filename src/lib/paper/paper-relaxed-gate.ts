import type { AgentOutput } from "@/lib/agents/types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { PaperTradingSettings } from "./paper-order-types";
import type {
  PaperHardBlockReason,
  PaperMode,
  PaperOpenEligibility,
  RelaxedPaperSettings,
} from "./paper-relaxed-types";
import { DEFAULT_RELAXED_PAPER_SETTINGS } from "./paper-relaxed-types";
import {
  resolveRiskBudgetSizePct,
  riskBudgetBlocksNewTrade,
} from "@/lib/risk-budget-optimizer/apply-risk-budget";

/** Relaxed paper mode can never enable live execution paths. */
export function relaxedPaperBlocksLiveExecution(
  paperMode: PaperMode = "STRICT_PAPER",
): boolean {
  return paperMode === "RELAXED_PAPER";
}

export function isRelaxedPaperMode(
  settings: Pick<PaperTradingSettings, "paperMode">,
): boolean {
  return settings.paperMode === "RELAXED_PAPER";
}

export function resolveRelaxedSettings(
  settings: Partial<PaperTradingSettings>,
): RelaxedPaperSettings {
  return {
    ...DEFAULT_RELAXED_PAPER_SETTINGS,
    ...settings,
  };
}

function strictCommitteeVerdict(data: AnalyzeApiResponse) {
  return (
    data.finalVerdict ??
    data.tradingDesk?.committee.finalVerdict ??
    "WAIT"
  );
}

function optionsAgent(data: AnalyzeApiResponse): AgentOutput | null {
  const agents = data.tradingDesk?.agents ?? [];
  return agents.find((a) => a.strategyType === "OPTIONS") ?? null;
}

function playbookSupportsTrade(
  data: AnalyzeApiResponse,
  settings: RelaxedPaperSettings,
): boolean {
  const rec = data.step5_verdict.recommendation;
  const confidence = data.step5_verdict.confidence;
  if (rec === "trade") return true;
  if (
    rec === "wait" &&
    settings.relaxedAllowWaitToPaperTrade &&
    confidence >= settings.relaxedMinConfidence
  ) {
    return true;
  }
  return false;
}

function triggeredHardNoTradeRules(data: AnalyzeApiResponse): {
  liquidation: boolean;
  macro: boolean;
  detail: string | null;
} {
  const rules = data.step3_noTradeRules ?? data.noTradeRules ?? [];
  const liq = rules.find(
    (r) => r.id === "liquidation-cascade" && r.triggered && r.severity === "hard",
  );
  const macro = rules.find(
    (r) => r.id === "macro-event" && r.triggered && r.severity === "hard",
  );
  const detail = liq?.message ?? macro?.message ?? null;
  return {
    liquidation: Boolean(liq),
    macro: Boolean(macro),
    detail,
  };
}

export function evaluatePaperHardBlocks(
  data: AnalyzeApiResponse,
  governance?: Pick<
    GovernanceDeskState,
    "operatorPaused" | "safeMode"
  > | null,
): { blocked: boolean; reason: PaperHardBlockReason | null; detail: string | null } {
  const desk = data.tradingDesk;
  const btc = data.step1_marketSnapshot.spotPrice;

  if (btc <= 0) {
    return { blocked: true, reason: "INVALID_TAPE", detail: "BTC spot unavailable." };
  }

  if (desk?.riskManager.veto || desk?.committee.riskVeto) {
    return {
      blocked: true,
      reason: "RISK_VETO",
      detail: desk.riskManager.vetoReasons?.[0] ?? "Risk Manager veto.",
    };
  }

  if (governance?.operatorPaused || governance?.safeMode) {
    return {
      blocked: true,
      reason: "GOVERNANCE_KILL_SWITCH",
      detail: governance.safeMode
        ? "Governance safe mode active."
        : "Operator kill switch / pause active.",
    };
  }

  if (data.dataTrust?.grade === "CRITICAL") {
    return {
      blocked: true,
      reason: "DATA_TRUST_CRITICAL",
      detail:
        data.dataTrust.criticalIssues[0] ?? "Data trust CRITICAL — paper blocked.",
    };
  }

  if (data.preMortem?.preMortemVerdict === "BLOCK") {
    return {
      blocked: true,
      reason: "PRE_MORTEM_BLOCK",
      detail: data.preMortem.topFailureReason ?? "Pre-mortem BLOCK.",
    };
  }

  const noTrade = triggeredHardNoTradeRules(data);
  if (noTrade.liquidation) {
    return {
      blocked: true,
      reason: "LIQUIDATION_RULE",
      detail: noTrade.detail,
    };
  }
  if (noTrade.macro) {
    return {
      blocked: true,
      reason: "MACRO_EVENT_BLOCK",
      detail: noTrade.detail,
    };
  }

  const instrument = data.step6_actionPlan.action;
  if (instrument === "no_trade") {
    return {
      blocked: true,
      reason: "NO_TRADE_INSTRUMENT",
      detail: "Action plan is no_trade.",
    };
  }

  return { blocked: false, reason: null, detail: null };
}

function evaluateStrictPaperEligible(data: AnalyzeApiResponse): boolean {
  const verdict = strictCommitteeVerdict(data);
  if (verdict !== "TRADE") return false;
  if (data.tradingDesk?.committee.riskVeto) return false;
  if (data.tradingDesk?.riskManager.veto) return false;
  return data.step6_actionPlan.action !== "no_trade";
}

function evaluateRelaxedPaperEligible(
  data: AnalyzeApiResponse,
  settings: RelaxedPaperSettings,
): { eligible: boolean; reason: string | null } {
  const committeeVerdict = strictCommitteeVerdict(data);
  const playbookRec = data.step5_verdict.recommendation;
  const options = optionsAgent(data);
  const playbookOk = playbookSupportsTrade(data, settings);

  if (playbookRec === "trade" && playbookOk) {
    return {
      eligible: true,
      reason: "Playbook TRADE — relaxed paper learning entry.",
    };
  }

  if (
    playbookRec === "wait" &&
    settings.relaxedAllowWaitToPaperTrade &&
    data.step5_verdict.confidence >= settings.relaxedMinConfidence
  ) {
    return {
      eligible: true,
      reason: `Playbook WAIT @ ${data.step5_verdict.confidence}% ≥ ${settings.relaxedMinConfidence}% threshold.`,
    };
  }

  if (committeeVerdict === "WAIT" && playbookOk) {
    const optionsAgrees =
      !settings.relaxedRequireOptionsAgentAgree ||
      options?.recommendation === "TRADE";
    if (optionsAgrees) {
      return {
        eligible: true,
        reason:
          "Committee WAIT — options + playbook align for relaxed paper entry.",
      };
    }
  }

  return { eligible: false, reason: null };
}

function applyRiskBudgetCap(
  data: AnalyzeApiResponse,
  cap: number,
): number {
  return resolveRiskBudgetSizePct(data, cap);
}

export function evaluatePaperOpenEligibility(
  data: AnalyzeApiResponse,
  settings: Partial<PaperTradingSettings> = {},
  governance?: Pick<GovernanceDeskState, "operatorPaused" | "safeMode"> | null,
): PaperOpenEligibility {
  const resolved = resolveRelaxedSettings(settings);
  const strictVerdict = strictCommitteeVerdict(data);
  const hard = evaluatePaperHardBlocks(data, governance);

  if (riskBudgetBlocksNewTrade(data.riskBudget)) {
    return {
      eligible: false,
      paperMode: resolved.paperMode,
      strictVerdict,
      relaxedVerdict: "SKIP",
      relaxedReason: null,
      hardBlock: "RISK_BUDGET",
      hardBlockDetail:
        data.riskBudget?.blockReasons[0] ?? "Risk budget blocks new trades.",
      sizePctCap: 0,
    };
  }

  if (hard.blocked) {
    return {
      eligible: false,
      paperMode: resolved.paperMode,
      strictVerdict,
      relaxedVerdict: "SKIP",
      relaxedReason: null,
      hardBlock: hard.reason,
      hardBlockDetail: hard.detail,
      sizePctCap: resolved.relaxedMaxPositionSizePct,
    };
  }

  const strictEligible = evaluateStrictPaperEligible(data);

  if (resolved.paperMode === "STRICT_PAPER") {
    return {
      eligible: strictEligible,
      paperMode: "STRICT_PAPER",
      strictVerdict,
      relaxedVerdict: strictEligible ? "TRADE" : strictVerdict,
      relaxedReason: strictEligible ? "Committee TRADE (strict paper)." : null,
      hardBlock: null,
      hardBlockDetail: null,
      sizePctCap: applyRiskBudgetCap(
        data,
        data.step6_actionPlan.suggestedSizePct || 1,
      ),
    };
  }

  if (strictEligible) {
    return {
      eligible: true,
      paperMode: "RELAXED_PAPER",
      strictVerdict,
      relaxedVerdict: "TRADE",
      relaxedReason: "Committee TRADE — also valid in relaxed mode.",
      hardBlock: null,
      hardBlockDetail: null,
      sizePctCap: applyRiskBudgetCap(
        data,
        Math.min(
          data.step6_actionPlan.suggestedSizePct || 1,
          resolved.relaxedMaxPositionSizePct,
        ),
      ),
    };
  }

  const relaxed = evaluateRelaxedPaperEligible(data, resolved);
  return {
    eligible: relaxed.eligible,
    paperMode: "RELAXED_PAPER",
    strictVerdict,
    relaxedVerdict: relaxed.eligible ? "TRADE" : strictVerdict,
    relaxedReason: relaxed.reason,
    hardBlock: null,
    hardBlockDetail: null,
    sizePctCap: applyRiskBudgetCap(data, resolved.relaxedMaxPositionSizePct),
  };
}
