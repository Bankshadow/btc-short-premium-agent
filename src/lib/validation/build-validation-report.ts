import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import {
  filterProductionEntries,
  filterProductionOrders,
} from "@/lib/journal/production-filter";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { buildStrategyPerformanceMatrix } from "./strategy-performance";
import { buildAgentValidationBoard } from "./agent-promotion";
import {
  buildRegimePerformance,
  normalizeRegimeLabel,
  getRegimeRule,
  isStrategyAllowedInRegime,
} from "./regime-router";
import { buildCapitalAllocation } from "./capital-allocation";
import {
  evaluateKillSwitch,
  recentOperatorOverrides,
  loadKillSwitchState,
} from "./kill-switch";
import { STRATEGY_LABELS } from "./validation-config";
import type {
  ValidationActionItem,
  ValidationReport,
} from "./validation-types";

export function buildValidationActions(
  strategyMatrix: ValidationReport["strategyMatrix"],
  regime: ValidationReport["currentRegime"],
): {
  disableNext: ValidationActionItem[];
  scaleNext: ValidationActionItem[];
} {
  const disableNext: ValidationActionItem[] = [];
  const scaleNext: ValidationActionItem[] = [];

  for (const row of strategyMatrix) {
    if (row.status === "DISABLED" || row.status === "PAPER_ONLY") {
      disableNext.push({
        kind: "disable",
        target: row.label,
        reason: row.promotionReason,
        priority: row.status === "DISABLED" ? "high" : "medium",
      });
    } else if (row.status === "ACTIVE") {
      if (!isStrategyAllowedInRegime(row.id, regime)) {
        disableNext.push({
          kind: "disable",
          target: row.label,
          reason: `Blocked in current regime (${getRegimeRule(regime).label}).`,
          priority: "high",
        });
      } else {
        scaleNext.push({
          kind: "scale",
          target: row.label,
          reason: `ACTIVE · win ${row.winRate}% · avg R ${row.averageR}`,
          priority: "medium",
        });
      }
    } else if (row.status === "WATCHLIST") {
      scaleNext.push({
        kind: "watch",
        target: row.label,
        reason: "Gather more resolved signals before scaling.",
        priority: "low",
      });
    }
  }

  return {
    disableNext: disableNext.slice(0, 6),
    scaleNext: scaleNext.slice(0, 6),
  };
}

export function buildValidationReport(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  latestAnalysis?: AnalyzeApiResponse | null;
}): ValidationReport {
  const entries = filterProductionEntries(input.entries);
  const orders = filterProductionOrders(input.orders);
  const strategyMatrix = buildStrategyPerformanceMatrix(
    entries,
    orders,
    input.riskProfile,
  );
  const agentBoard = buildAgentValidationBoard(entries, strategyMatrix);
  const regimePerformance = buildRegimePerformance(entries);
  const scoreboard = buildAgentScoreboard(entries);
  const portfolio = buildDeskPortfolioSnapshot(entries, orders);

  const latestRegime = input.latestAnalysis?.tradingDesk?.marketRegime;
  const lastEntryRegime = entries[0]?.marketRegime;
  const currentRegime = normalizeRegimeLabel(
    latestRegime ?? lastEntryRegime ?? "Mixed / unclear",
  );
  const currentRegimeLabel = getRegimeRule(currentRegime).label;

  const killSwitch = evaluateKillSwitch({
    entries,
    orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.latestAnalysis,
    persisted:
      typeof window !== "undefined" ? loadKillSwitchState() : undefined,
  });

  const capitalAllocation = buildCapitalAllocation({
    strategyMatrix,
    scoreboard,
    portfolio,
    killSwitch,
    currentRegime,
  });

  const { disableNext, scaleNext } = buildValidationActions(
    strategyMatrix,
    currentRegime,
  );

  return {
    generatedAt: new Date().toISOString(),
    strategyMatrix,
    agentBoard,
    regimePerformance,
    capitalAllocation,
    killSwitch,
    recentOverrides: recentOperatorOverrides(),
    disableNext,
    scaleNext,
    currentRegime,
    currentRegimeLabel,
    riskProfile: input.riskProfile,
  };
}

export function strategyStatusSummary(
  report: ValidationReport,
): string {
  const active = report.strategyMatrix.filter((s) => s.status === "ACTIVE");
  return active.map((s) => STRATEGY_LABELS[s.id]).join(", ") || "None active";
}
