import type { AgentRecommendation } from "@/lib/agents/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { UnifiedPaperPosition } from "./unified-types";

function pnlUsd(notionalUsd: number, pnlPct: number | null): number {
  if (pnlPct == null || !Number.isFinite(pnlPct)) return 0;
  return Number(((notionalUsd * pnlPct) / 100).toFixed(2));
}

function optionsStrategyName(instrument: PaperOrder["instrument"]): string {
  if (instrument === "sell_call") return "btc_short_premium";
  if (instrument === "sell_put") return "btc_put_premium";
  return "btc_options";
}

function lookupLog(
  logById: Map<string, DecisionLogEntry>,
  decisionLogId: string,
): DecisionLogEntry | undefined {
  return logById.get(decisionLogId);
}

export function mapOptionsPaperOrder(
  order: PaperOrder,
  logById: Map<string, DecisionLogEntry>,
  defaultRiskProfile: DeskRiskProfile,
): UnifiedPaperPosition {
  const log = lookupLog(logById, order.decisionLogId);
  const realizedPct =
    order.status === "CLOSED" ? order.realizedPnlPct : null;
  const unrealizedPct =
    order.status === "OPEN" ? order.unrealizedPnlPct : null;

  return {
    id: `opt-${order.id}`,
    book: "btc_options",
    symbol: order.symbol,
    assetId: "BTC",
    side: order.side,
    strategyName: optionsStrategyName(order.instrument),
    sourceAgent: "Investment Committee",
    decisionLogId: order.decisionLogId,
    verdict: log?.finalVerdict ?? order.committeeVerdict,
    riskProfile: log?.deskRiskProfile ?? defaultRiskProfile,
    status: order.status,
    createdAt: order.openedAt,
    closedAt: order.closedAt,
    notionalUsd: order.notionalUsd,
    sizePct: order.sizePct,
    entryPrice: order.entryBtcPrice,
    exitPrice: order.exitBtcPrice,
    realizedPnlUsd: pnlUsd(order.notionalUsd, realizedPct),
    realizedPnlPct: realizedPct,
    unrealizedPnlUsd: pnlUsd(order.notionalUsd, unrealizedPct),
    unrealizedPnlPct: unrealizedPct,
    legacyRef: { book: "btc_options", id: order.id },
    notes: order.notes || order.instrument,
    paperMode: order.paperMode ?? "STRICT_PAPER",
    relaxedReason: order.relaxedReason ?? null,
  };
}

export function mapPerpPaperPosition(
  position: PerpPaperPosition,
  logById: Map<string, DecisionLogEntry>,
  defaultRiskProfile: DeskRiskProfile,
): UnifiedPaperPosition {
  const logId =
    position.decisionLogId ?? `perp-trace-${position.id}`;
  const log = position.decisionLogId
    ? lookupLog(logById, position.decisionLogId)
    : undefined;

  const realizedPct =
    position.status === "CLOSED" ? position.realizedPnlPct : null;
  const unrealizedPct =
    position.status === "OPEN" ? position.unrealizedPnlPct : null;

  return {
    id: `perp-${position.id}`,
    book: "perp_directional",
    symbol: position.symbol,
    assetId: position.assetId,
    side: position.direction.toLowerCase(),
    strategyName: position.strategyName ?? "perp_directional",
    sourceAgent: position.sourceAgent ?? "Perp Directional Agent",
    decisionLogId: logId,
    verdict:
      position.verdict ??
      log?.finalVerdict ??
      (position.direction === "LONG" || position.direction === "SHORT"
        ? "TRADE"
        : "WAIT"),
    riskProfile: position.riskProfile ?? log?.deskRiskProfile ?? defaultRiskProfile,
    status: position.status,
    createdAt: position.openedAt,
    closedAt: position.closedAt,
    notionalUsd: position.notionalUsd,
    sizePct: position.sizePct,
    entryPrice: position.entryPrice,
    exitPrice: position.exitPrice,
    realizedPnlUsd: pnlUsd(position.notionalUsd, realizedPct),
    realizedPnlPct: realizedPct,
    unrealizedPnlUsd: pnlUsd(position.notionalUsd, unrealizedPct),
    unrealizedPnlPct: unrealizedPct,
    legacyRef: { book: "perp_directional", id: position.id },
    notes: position.reason,
  };
}

export function mapAllToUnifiedPositions(input: {
  orders: PaperOrder[];
  perpPositions: PerpPaperPosition[];
  entries: DecisionLogEntry[];
  riskProfile: DeskRiskProfile;
}): UnifiedPaperPosition[] {
  const logById = new Map(input.entries.map((e) => [e.id, e]));
  const options = input.orders.map((o) =>
    mapOptionsPaperOrder(o, logById, input.riskProfile),
  );
  const perps = input.perpPositions.map((p) =>
    mapPerpPaperPosition(p, logById, input.riskProfile),
  );
  return [...options, ...perps].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
