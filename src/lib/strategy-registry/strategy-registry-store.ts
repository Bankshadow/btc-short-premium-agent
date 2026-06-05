import type { StrategyId } from "@/lib/validation/validation-types";
import { STRATEGY_REGISTRY_SEEDS } from "./strategy-registry-config";
import type {
  StrategyRegistryOverride,
  StrategyRegistryOverrides,
  StrategyRegistryStatus,
  StrategyVersionEntry,
} from "./strategy-registry-types";

export const STRATEGY_REGISTRY_STORAGE_KEY =
  "trading-agents-crypto-desk:strategy-registry";

export interface PersistedStrategyRegistry {
  overrides: StrategyRegistryOverrides;
  versionHistory: Partial<Record<StrategyId, StrategyVersionEntry[]>>;
}

export const DEFAULT_PERSISTED_REGISTRY: PersistedStrategyRegistry = {
  overrides: {},
  versionHistory: {},
};

export function loadPersistedRegistry(): PersistedStrategyRegistry {
  if (typeof window === "undefined") return DEFAULT_PERSISTED_REGISTRY;
  try {
    const raw = localStorage.getItem(STRATEGY_REGISTRY_STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED_REGISTRY;
    const parsed = JSON.parse(raw) as PersistedStrategyRegistry;
    return {
      ...DEFAULT_PERSISTED_REGISTRY,
      overrides: parsed.overrides ?? {},
      versionHistory: parsed.versionHistory ?? {},
    };
  } catch {
    return DEFAULT_PERSISTED_REGISTRY;
  }
}

export function savePersistedRegistry(
  next: PersistedStrategyRegistry,
): PersistedStrategyRegistry {
  if (typeof window !== "undefined") {
    localStorage.setItem(STRATEGY_REGISTRY_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function getOverride(id: StrategyId): StrategyRegistryOverride | undefined {
  return loadPersistedRegistry().overrides[id];
}

export function patchStrategyOverride(
  id: StrategyId,
  patch: StrategyRegistryOverride,
  versionNote?: string,
): PersistedStrategyRegistry {
  const current = loadPersistedRegistry();
  const prev = current.overrides[id] ?? {};
  const merged = { ...prev, ...patch };
  const overrides = { ...current.overrides, [id]: merged };

  let versionHistory = { ...current.versionHistory };
  if (patch.status && versionNote) {
    const seed = STRATEGY_REGISTRY_SEEDS.find((s) => s.id === id);
    const history = [...(versionHistory[id] ?? [])];
    history.unshift({
      version: seed?.version ?? "1.0.0",
      changedAt: new Date().toISOString(),
      note: versionNote,
      status: patch.status,
    });
    versionHistory = { ...versionHistory, [id]: history.slice(0, 20) };
  }

  const saved = savePersistedRegistry({ overrides, versionHistory });
  if (typeof window !== "undefined") {
    void fetch("/api/db/migrate-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategyRegistry: saved }),
    }).catch(() => undefined);
  }
  return saved;
}
