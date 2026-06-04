import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { buildStrategyPerformanceMatrix } from "@/lib/validation/strategy-performance";
import { STRATEGY_REGISTRY_SEEDS } from "./strategy-registry-config";
import { loadPersistedRegistry } from "./strategy-registry-store";
import {
  computePerformanceScore,
  validationStatusToRegistry,
} from "./strategy-registry-status";
import type {
  StrategyRegistryAnalyzePayload,
  StrategyRegistrySnapshot,
  StrategySkill,
} from "./strategy-registry-types";
import type { StrategyId } from "@/lib/validation/validation-types";

function lastUsedForStrategy(
  id: StrategyId,
  entries: DecisionLogEntry[],
): string | null {
  for (const e of entries) {
    const agents = e.agentOutputs ?? [];
    const seed = STRATEGY_REGISTRY_SEEDS.find((s) => s.id === id);
    if (!seed) continue;
    const hit = agents.some(
      (a) =>
        a.agentName === seed.ownerAgent && a.recommendation === "TRADE",
    );
    if (hit) return e.timestamp;
  }
  return null;
}

export function buildStrategyRegistry(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
}): StrategyRegistrySnapshot {
  const matrix = buildStrategyPerformanceMatrix(
    input.entries,
    input.orders,
    input.riskProfile,
  );
  const matrixById = new Map(matrix.map((r) => [r.id, r]));
  const persisted = loadPersistedRegistry();

  const strategies: StrategySkill[] = STRATEGY_REGISTRY_SEEDS.map((seed) => {
    const row = matrixById.get(seed.id);
    const override = persisted.overrides[seed.id];
    const autoStatus = row
      ? validationStatusToRegistry(row.status)
      : seed.defaultStatus;
    const status = override?.statusLocked
      ? (override.status ?? autoStatus)
      : override?.status ?? autoStatus;

    const winRate = row?.winRate ?? 0;
    const avgR = row?.averageR ?? 0;
    const maxDrawdown = row?.maxDrawdownPct ?? 0;
    const sampleSize = row?.resolvedSignals ?? 0;

    const history = persisted.versionHistory[seed.id] ?? [];
    const versionHistory =
      history.length > 0
        ? history
        : [
            {
              version: seed.version,
              changedAt: new Date(0).toISOString(),
              note: "Initial registry seed",
              status: seed.defaultStatus,
            },
          ];

    return {
      id: seed.id,
      name: seed.name,
      version: seed.version,
      productType: seed.productType,
      allowedRegimes: seed.allowedRegimes,
      riskLevel: seed.riskLevel,
      requiredData: seed.requiredData,
      ownerAgent: seed.ownerAgent,
      status,
      performanceScore: computePerformanceScore({
        winRate,
        avgR,
        sampleSize,
        maxDrawdown,
      }),
      winRate,
      avgR,
      maxDrawdown,
      sampleSize,
      lastUsed: lastUsedForStrategy(seed.id, input.entries),
      linkedDraftRules: override?.linkedDraftRules ?? [],
      versionHistory,
      statusLocked: Boolean(override?.statusLocked),
      promotionReason: row?.promotionReason ?? "Insufficient desk sample.",
    };
  });

  return {
    strategies,
    generatedAt: new Date().toISOString(),
  };
}

/** Payload for tickets when analyze body not available (browser only). */
export function buildRegistryPayloadFromDesk(
  riskProfile: DeskRiskProfile = "balanced",
): StrategyRegistryAnalyzePayload {
  return buildRegistryPayloadForAnalyze(
    buildStrategyRegistry({
      entries: typeof window === "undefined" ? [] : loadDecisionLog(),
      orders: typeof window === "undefined" ? [] : loadPaperOrders(),
      riskProfile,
    }),
  );
}

export function buildRegistryPayloadForAnalyze(
  snapshot?: StrategyRegistrySnapshot,
): StrategyRegistryAnalyzePayload {
  const reg =
    snapshot ??
    buildStrategyRegistry({
      entries: [],
      orders: [],
      riskProfile: "balanced",
    });
  return {
    strategies: reg.strategies.map((s) => ({
      id: s.id,
      status: s.status,
      linkedDraftRules: s.linkedDraftRules,
    })),
  };
}

export function registryMapFromPayload(
  payload?: StrategyRegistryAnalyzePayload | null,
): Map<StrategyId, StrategySkill["status"]> {
  const map = new Map<StrategyId, StrategySkill["status"]>();
  if (!payload?.strategies?.length) {
    for (const seed of STRATEGY_REGISTRY_SEEDS) {
      map.set(seed.id, seed.defaultStatus);
    }
    return map;
  }
  for (const s of payload.strategies) {
    map.set(s.id, s.status);
  }
  for (const seed of STRATEGY_REGISTRY_SEEDS) {
    if (!map.has(seed.id)) map.set(seed.id, seed.defaultStatus);
  }
  return map;
}

export function getStrategyById(
  snapshot: StrategyRegistrySnapshot,
  id: StrategyId,
): StrategySkill | undefined {
  return snapshot.strategies.find((s) => s.id === id);
}
