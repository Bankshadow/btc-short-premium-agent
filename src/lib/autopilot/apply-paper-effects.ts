import { resolveEffectiveMode } from "./config";
import type { AutopilotSettings } from "./types";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { isHumanApprovalRequired } from "@/lib/trade-control/trade-control-settings";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import {
  loadPaperSettings,
  savePaperSettings,
} from "@/lib/paper/paper-orders";

function isSameUtcDay(a: string, b: Date): boolean {
  const d = new Date(a);
  return (
    d.getUTCFullYear() === b.getUTCFullYear() &&
    d.getUTCMonth() === b.getUTCMonth() &&
    d.getUTCDate() === b.getUTCDate()
  );
}

export function countPaperTradesOpenedToday(orders: PaperOrder[]): number {
  const now = new Date();
  return orders.filter(
    (o) => o.openedAt && isSameUtcDay(o.openedAt, now) && o.paperMode !== "RELAXED_PAPER",
  ).length;
}

export function countShadowTradesOpenedToday(orders: PaperOrder[]): number {
  const now = new Date();
  return orders.filter(
    (o) => o.openedAt && isSameUtcDay(o.openedAt, now) && o.paperMode === "RELAXED_PAPER",
  ).length;
}

export type AutopilotPaperEffects = {
  skipAutoOpen: boolean;
  reason: string | null;
};

export function resolveAutopilotPaperEffects(
  settings: AutopilotSettings,
  orders: PaperOrder[],
): AutopilotPaperEffects {
  const mode = resolveEffectiveMode(settings);
  const gov = loadGovernanceState();

  if (gov.pausePaperAutoOpen || gov.operatorPaused || gov.safeMode) {
    return {
      skipAutoOpen: true,
      reason: "Governance pause — paper autopilot blocked.",
    };
  }

  if (isHumanApprovalRequired() && mode !== "SHADOW_AUTOPILOT") {
    return {
      skipAutoOpen: true,
      reason: "Human approval required before paper trades.",
    };
  }

  if (mode === "PAPER_AUTOPILOT" && settings.paperAutopilotEnabled) {
    const today = countPaperTradesOpenedToday(orders);
    if (today >= settings.maxPaperTradesPerDay) {
      return {
        skipAutoOpen: true,
        reason: `Daily paper limit (${settings.maxPaperTradesPerDay}) reached.`,
      };
    }
    return { skipAutoOpen: false, reason: null };
  }

  if (mode === "SHADOW_AUTOPILOT" && settings.shadowModeEnabled) {
    const today = countShadowTradesOpenedToday(orders);
    if (today >= settings.maxShadowTradesPerDay) {
      return {
        skipAutoOpen: true,
        reason: `Daily shadow limit (${settings.maxShadowTradesPerDay}) reached.`,
      };
    }
    return { skipAutoOpen: false, reason: null };
  }

  return {
    skipAutoOpen: isHumanApprovalRequired(),
    reason: null,
  };
}

/** Apply paper mode overrides for autopilot before opening trades. */
export function applyAutopilotPaperSettings(settings: AutopilotSettings): void {
  const mode = resolveEffectiveMode(settings);
  const current = loadPaperSettings();

  if (mode === "SHADOW_AUTOPILOT" && settings.shadowModeEnabled) {
    savePaperSettings({
      ...current,
      autoOpenOnTrade: true,
      paperMode: "RELAXED_PAPER",
    });
    return;
  }

  if (mode === "PAPER_AUTOPILOT" && settings.paperAutopilotEnabled) {
    savePaperSettings({
      ...current,
      autoOpenOnTrade: true,
      paperMode: "STRICT_PAPER",
    });
  }
}
