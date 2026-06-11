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
  getDefaultUiProjectionData,
  getUiProjectionData,
  uiProjectionHasRealTrades,
  type UiProjectionData,
} from "@/lib/core/ui-projection-data";

export interface UiProjectionContextValue extends UiProjectionData {
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
}

const UiProjectionContext = createContext<UiProjectionContextValue | null>(null);

export function ProjectionBundleProvider({
  children,
  initialUiBundle,
}: {
  children: ReactNode;
  initialUiBundle: UiProjectionData;
}) {
  const [ui, setUi] = useState<UiProjectionData>(initialUiBundle);
  const [loading, setLoading] = useState(initialUiBundle.isFallback);
  const [refreshing, setRefreshing] = useState(false);
  const fetchGeneration = useRef(0);
  const serverBundleReady = useRef(uiProjectionHasRealTrades(initialUiBundle));

  const loadUi = useCallback(async (mode: "initial" | "refresh") => {
    const generation = ++fetchGeneration.current;
    if (mode === "initial") setLoading(true);
    setRefreshing(true);

    try {
      const data = await getUiProjectionData({ includeBinance: true });
      if (generation !== fetchGeneration.current) return;
      if (data.isFallback && serverBundleReady.current) {
        return;
      }
      if (data.source === "REAL_BUNDLE") {
        serverBundleReady.current = true;
      }
      setUi(data);
    } catch {
      if (generation !== fetchGeneration.current) return;
      if (!serverBundleReady.current) {
        setUi(getDefaultUiProjectionData());
      }
    } finally {
      if (generation === fetchGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (serverBundleReady.current) {
      setLoading(false);
      return;
    }
    void loadUi("initial");
  }, [loadUi]);

  const reload = useCallback(async () => {
    await loadUi("refresh");
  }, [loadUi]);

  const value = useMemo(
    (): UiProjectionContextValue => ({
      ...ui,
      loading,
      refreshing,
      reload,
    }),
    [loading, refreshing, reload, ui],
  );

  return <UiProjectionContext.Provider value={value}>{children}</UiProjectionContext.Provider>;
}

export function useUiProjectionData(_refreshKey = 0): UiProjectionContextValue {
  const ctx = useContext(UiProjectionContext);
  if (!ctx) {
    throw new Error("useUiProjectionData must be used within ProjectionBundleProvider");
  }

  useEffect(() => {
    if (_refreshKey > 0) {
      void ctx.reload();
    }
  }, [_refreshKey, ctx.reload]);

  return ctx;
}

/** @deprecated Use useUiProjectionData — kept for gradual migration. */
export function useProjectionBundle(_refreshKey = 0) {
  const ui = useUiProjectionData(_refreshKey);
  return useMemo(
    () => ({
      bundle: {
        ok: !ui.isFallback,
        mission: {
          ...ui.mission,
          win: 0,
          loss: 0,
          breakeven: 0,
          winCount: 0,
          lossCount: 0,
          breakevenCount: 0,
          zeroState: ui.isFallback,
        },
        trades: {
          open: ui.trades.open,
          closed: ui.trades.closed,
          effectiveOpenCount: ui.trades.effectiveOpenCount,
          staleOpenWarnings: ui.trades.staleOpenWarnings,
          openCount: ui.trades.effectiveOpenCount,
          closedCount: ui.trades.closed.length,
          totalTrades: ui.mission.totalTrades,
          summary: {
            openCount: ui.trades.effectiveOpenCount,
            closedCount: ui.trades.closed.length,
            realizedPnl: ui.mission.netPnl,
            executionCount: ui.mission.totalTrades,
          },
          zeroState: ui.isFallback,
        },
        positions: { openTradeCount: ui.trades.effectiveOpenCount, zeroState: ui.isFallback },
        pnl: { totalNetPnl: ui.mission.netPnl, zeroState: ui.isFallback },
        evidence: ui.evidence,
        risk: ui.risk,
        health: ui.health,
        binanceStatus: ui.binanceStatus,
        errors: ui.errors,
        warnings: ui.warnings,
        loadedAt: ui.loadedAt,
      },
      normalized: null,
      mission: ui.mission,
      trades: ui.trades,
      positions: { openTradeCount: ui.trades.effectiveOpenCount, zeroState: ui.isFallback },
      pnl: { totalNetPnl: ui.mission.netPnl },
      evidence: ui.evidence,
      risk: ui.risk,
      health: ui.health,
      binanceStatus: ui.binanceStatus,
      errors: ui.errors,
      warnings: ui.warnings,
      ok: !ui.isFallback,
      ready: ui.source === "REAL_BUNDLE",
      isFallback: ui.isFallback,
      debugSource: ui.source,
      debugSummary: {
        totalTrades: ui.mission.totalTrades,
        closedTrades: ui.mission.closedTrades,
        openTrades: ui.mission.openTrades,
        evidenceValid: ui.evidence.valid,
        evidenceRequired: ui.evidence.required,
        healthStatus: ui.health.status,
        binanceStatus: ui.binanceStatus.status,
      },
      loadedAt: ui.loadedAt,
      error: ui.errors[0]?.message ?? null,
      loading: ui.loading,
      refreshing: ui.refreshing,
      reload: ui.reload,
    }),
    [ui],
  );
}
