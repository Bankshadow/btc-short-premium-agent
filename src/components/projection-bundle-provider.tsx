"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getProjectionBundleForUI,
  type ProjectionBundleClientResult,
} from "@/lib/core/projection-client";
import type { NormalizedProjectionBundle } from "@/lib/core/normalize-projection-bundle";
import { mapBundleToDashboardMetrics } from "@/lib/core/dashboard-projection-map";
import { bundleProjectionReady } from "@/lib/core/ui-projection-bind";
import type { ProjectionSectionError } from "@/lib/core/projection-defaults";
import {
  getDefaultProjectionBundle,
  PROJECTION_FALLBACK_ACTIVE_MESSAGE,
  PROJECTION_UNAVAILABLE_MESSAGE,
} from "@/lib/core/projection-defaults";

export interface ProjectionBundleDebugSummary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  evidenceValid: number;
  evidenceRequired: number;
  healthStatus: string;
  binanceStatus: string;
}

export interface ProjectionBundleContextValue {
  bundle: ProjectionBundleClientResult;
  normalized: NormalizedProjectionBundle | null;
  mission: ProjectionBundleClientResult["mission"];
  trades: ProjectionBundleClientResult["trades"];
  positions: ProjectionBundleClientResult["positions"];
  pnl: ProjectionBundleClientResult["pnl"];
  evidence: ProjectionBundleClientResult["evidence"];
  risk: ProjectionBundleClientResult["risk"];
  health: ProjectionBundleClientResult["health"];
  binanceStatus: ProjectionBundleClientResult["binanceStatus"];
  errors: ProjectionSectionError[];
  warnings: string[];
  ok: boolean;
  ready: boolean;
  isFallback: boolean;
  debugSource: "REAL_BUNDLE" | "FALLBACK";
  debugSummary: ProjectionBundleDebugSummary;
  loadedAt: string;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
}

const ProjectionBundleContext = createContext<ProjectionBundleContextValue | null>(null);

export function ProjectionBundleProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => getDefaultProjectionBundle(), []);
  const [state, setState] = useState<ProjectionBundleClientResult>(initial);
  const [normalized, setNormalized] = useState<NormalizedProjectionBundle | null>(null);
  const [isFallback, setIsFallback] = useState(true);
  const [debugSource, setDebugSource] = useState<"REAL_BUNDLE" | "FALLBACK">("FALLBACK");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchGeneration = useRef(0);

  const loadBundle = useCallback(async (mode: "initial" | "refresh") => {
    const generation = ++fetchGeneration.current;
    if (mode === "initial") setLoading(true);
    setRefreshing(true);

    try {
      const result = await getProjectionBundleForUI({ includeBinance: true });
      if (generation !== fetchGeneration.current) return;
      setState(result.bundle);
      setNormalized(result.normalized);
      setIsFallback(result.isFallback);
      setDebugSource(result.debugSource);
      setWarnings(result.warnings);
    } catch {
      if (generation !== fetchGeneration.current) return;
      const fallback = getDefaultProjectionBundle();
      fallback.ok = false;
      setState(fallback);
      setNormalized(null);
      setIsFallback(true);
      setDebugSource("FALLBACK");
      setWarnings([PROJECTION_FALLBACK_ACTIVE_MESSAGE, PROJECTION_UNAVAILABLE_MESSAGE]);
    } finally {
      if (generation === fetchGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBundle("initial");
  }, [loadBundle]);

  const reload = useCallback(async () => {
    await loadBundle("refresh");
  }, [loadBundle]);

  const ready = bundleProjectionReady(state);

  const debugSummary = useMemo((): ProjectionBundleDebugSummary => {
    const metrics = mapBundleToDashboardMetrics({
      ok: state.ok,
      mission: state.mission,
      trades: state.trades,
      pnl: state.pnl,
      evidence: state.evidence,
      risk: state.risk,
      health: state.health,
    });
    return {
      totalTrades: metrics.totalTrades,
      closedTrades: metrics.closedTrades,
      openTrades: metrics.openTrades,
      evidenceValid: metrics.evidenceValid,
      evidenceRequired: metrics.evidenceRequired,
      healthStatus: metrics.coreHealthStatus,
      binanceStatus: state.binanceStatus?.status ?? "MISSING_ENV",
    };
  }, [state]);

  const value = useMemo(
    (): ProjectionBundleContextValue => ({
      bundle: state,
      normalized,
      mission: state.mission,
      trades: state.trades,
      positions: state.positions,
      pnl: state.pnl,
      evidence: state.evidence,
      risk: state.risk,
      health: state.health,
      binanceStatus: state.binanceStatus,
      errors: state.errors,
      warnings,
      ok: state.ok,
      ready,
      isFallback,
      debugSource,
      debugSummary,
      loadedAt: state.loadedAt,
      error: state.errors[0]?.message ?? null,
      loading,
      refreshing,
      reload,
    }),
    [debugSource, debugSummary, isFallback, loading, normalized, ready, refreshing, reload, state, warnings],
  );

  return (
    <ProjectionBundleContext.Provider value={value}>{children}</ProjectionBundleContext.Provider>
  );
}

export function useProjectionBundle(_refreshKey = 0): ProjectionBundleContextValue {
  const ctx = useContext(ProjectionBundleContext);
  if (!ctx) {
    throw new Error("useProjectionBundle must be used within ProjectionBundleProvider");
  }

  useEffect(() => {
    if (_refreshKey > 0) {
      void ctx.reload();
    }
  }, [_refreshKey, ctx.reload]);

  return ctx;
}
