import type { AnalyzeApiResponse } from "@/lib/types/market";
import { loadAutopilotSettings } from "@/lib/autopilot/settings-store";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import {
  closePaperOrderAndSyncLog,
  tryAutoOpenPaperOrder,
  tryAutoOpenShadowOrder,
} from "@/lib/paper/paper-execution";
import {
  findOrderByLogId,
  getOpenPaperOrders,
  hasOpenPaperOrder,
  loadPaperOrders,
  markOrdersToMarket,
  savePaperSettings,
  loadPaperSettings,
} from "@/lib/paper/paper-orders";
import {
  PAPER_AUTOPILOT_SAFETY_NOTICE,
  resolvePaperAutopilotModeFromAutopilot,
} from "./config";
import { evaluatePaperAutopilotCreate } from "./evaluate-create";
import {
  createLifecycleForOrder,
  findLifecycleByTradeId,
  loadPaperLifecycleRecords,
  syncLifecycleFromOrder,
  transitionLifecycle,
} from "./lifecycle-store";
import { monitorOpenLifecycle } from "./monitor";
import {
  getPendingResolutionQueue,
  processPendingAutoResolutions,
  resolveLifecycleNow,
} from "./resolve-queue";
import { loadPaperAutopilotSettings, savePaperAutopilotSettings } from "./settings-store";
import type {
  PaperAutopilotRunResult,
  PaperAutopilotSettings,
  PaperMonitorSignal,
} from "./types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { ResolveOutcomeInput } from "@/lib/journal/decision-log-types";

function newRunId(): string {
  return `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function effectiveSettings(
  patch?: Partial<PaperAutopilotSettings>,
): PaperAutopilotSettings {
  const stored = { ...loadPaperAutopilotSettings(), ...patch };
  if (stored.mode === "OFF") {
    const autopilot = loadAutopilotSettings();
    const derived = resolvePaperAutopilotModeFromAutopilot(autopilot);
    if (derived !== "OFF") {
      return {
        ...stored,
        mode: derived,
        autoResolveEnabled:
          patch?.autoResolveEnabled ?? autopilot.autoResolveEnabled,
        maxPaperTradesPerDay: autopilot.maxPaperTradesPerDay,
        maxShadowTradesPerDay: autopilot.maxShadowTradesPerDay,
      };
    }
  }
  return stored;
}

function applyPaperSettingsForCreate(action: "CREATE_PAPER" | "CREATE_SHADOW"): void {
  const current = loadPaperSettings();
  if (action === "CREATE_PAPER") {
    savePaperSettings({
      ...current,
      autoCreatePaperOnTrade: true,
      autoOpenOnTrade: true,
      paperMode: "STRICT_PAPER",
    });
    return;
  }
  savePaperSettings({
    ...current,
    autoCreateShadowOnWaitSkip: true,
    autoOpenOnTrade: true,
    paperMode: "RELAXED_PAPER",
    relaxedAllowWaitToPaperTrade: true,
  });
}

function closeWithAutopilot(
  orderId: string,
  input: { exitBtcPrice: number; notes: string },
  autoResolve: boolean,
): PaperOrder | null {
  const result = closePaperOrderAndSyncLog(orderId, {
    exitBtcPrice: input.exitBtcPrice,
    notes: input.notes,
    skipResolve: !autoResolve,
  });
  if (!result) return null;

  const lifecycle = findLifecycleByTradeId(orderId);
  if (lifecycle && lifecycle.status !== "RESOLVED") {
    if (autoResolve) {
      transitionLifecycle(lifecycle.lifecycleId, "RESOLVED", "Auto-resolved on close.", {
        realizedPnlPct: result.order.realizedPnlPct,
        closedAt: result.order.closedAt,
        resolvedAt: result.order.closedAt,
      });
    } else {
      transitionLifecycle(lifecycle.lifecycleId, "CLOSED", input.notes, {
        realizedPnlPct: result.order.realizedPnlPct,
        closedAt: result.order.closedAt,
        markBtcPrice: input.exitBtcPrice,
        unrealizedPnlPct: null,
      });
    }
  }
  return result.order;
}

export function runPaperAutopilot(input: {
  data?: AnalyzeApiResponse | null;
  decisionLogId?: string;
  btcPrice: number;
  settings?: Partial<PaperAutopilotSettings>;
}): PaperAutopilotRunResult {
  const at = new Date().toISOString();
  const settings = effectiveSettings(input.settings);
  const mode = settings.mode;
  const runId = newRunId();

  if (mode === "OFF") {
    return {
      runId,
      at,
      mode,
      skipped: true,
      skipReason: "Paper autopilot off.",
      created: [],
      monitored: 0,
      closeRecommended: 0,
      closed: 0,
      resolved: 0,
      pendingResolution: getPendingResolutionQueue().length,
      signals: [],
      createEvaluation: null,
      safetyNotice: PAPER_AUTOPILOT_SAFETY_NOTICE,
    };
  }

  const gov = loadGovernanceState();
  const govCtx = { operatorPaused: gov.operatorPaused, safeMode: gov.safeMode };
  const orders = loadPaperOrders();
  const created: PaperOrder[] = [];
  const allSignals: PaperMonitorSignal[] = [];
  let closeRecommended = 0;
  let closed = 0;

  if (input.btcPrice > 0) {
    markOrdersToMarket(input.btcPrice);
  }

  const openOrders = getOpenPaperOrders();
  const lifecycleByTrade = new Map(
    loadPaperLifecycleRecords().map((r) => [r.tradeId, r]),
  );

  for (const order of openOrders) {
    let record = lifecycleByTrade.get(order.id);
    if (!record) {
      record = createLifecycleForOrder(order);
      lifecycleByTrade.set(order.id, record);
    }
    const { record: updated, signals } = monitorOpenLifecycle(
      record,
      order,
      input.btcPrice,
      settings,
      input.data,
    );
    lifecycleByTrade.set(order.id, updated);
    allSignals.push(...signals);
    if (updated.status === "CLOSE_RECOMMENDED") closeRecommended += 1;
  }

  let createEvaluation = null as PaperAutopilotRunResult["createEvaluation"];
  if (input.data && input.decisionLogId) {
    createEvaluation = evaluatePaperAutopilotCreate({
      mode,
      data: input.data,
      settings,
      governance: gov,
      orders: loadPaperOrders(),
    });

    if (!createEvaluation.blocked && createEvaluation.action !== "NONE") {
      if (!findOrderByLogId(input.decisionLogId)) {
        if (
          createEvaluation.action === "CREATE_PAPER" &&
          !hasOpenPaperOrder()
        ) {
          applyPaperSettingsForCreate("CREATE_PAPER");
          const opened = tryAutoOpenPaperOrder(
            input.data,
            input.decisionLogId,
            govCtx,
          );
          if (opened) {
            created.push(opened);
            createLifecycleForOrder(opened);
          }
        } else if (createEvaluation.action === "CREATE_SHADOW") {
          applyPaperSettingsForCreate("CREATE_SHADOW");
          const opened = tryAutoOpenShadowOrder(
            input.data,
            input.decisionLogId,
            govCtx,
          );
          if (opened) {
            created.push(opened);
            createLifecycleForOrder(opened);
          }
        }
      }
    }
  }

  if (settings.autoCloseOnRecommendation && input.btcPrice > 0) {
    for (const record of loadPaperLifecycleRecords()) {
      if (record.status !== "CLOSE_RECOMMENDED") continue;
      const order = loadPaperOrders().find((o) => o.id === record.tradeId);
      if (!order || order.status !== "OPEN") continue;
      const note = record.closeRecommendation ?? "Autopilot close recommendation.";
      const closedOrder = closeWithAutopilot(
        order.id,
        { exitBtcPrice: input.btcPrice, notes: `Paper autopilot: ${note}` },
        settings.autoResolveEnabled,
      );
      if (closedOrder) closed += 1;
    }
  }

  const resolved = processPendingAutoResolutions(settings);
  savePaperAutopilotSettings({ lastRunAt: at, mode });

  for (const order of loadPaperOrders()) {
    syncLifecycleFromOrder(order);
  }

  return {
    runId,
    at,
    mode,
    skipped: false,
    skipReason: null,
    created,
    monitored: openOrders.length,
    closeRecommended,
    closed,
    resolved,
    pendingResolution: getPendingResolutionQueue().length,
    signals: allSignals,
    createEvaluation,
    safetyNotice: PAPER_AUTOPILOT_SAFETY_NOTICE,
  };
}

export function manualResolvePaperLifecycle(
  lifecycleId: string,
  input: ResolveOutcomeInput,
) {
  return resolveLifecycleNow(lifecycleId, input);
}
