"use client";

import { useCallback, useEffect, useState } from "react";
import { getProjectionBundle, type ProjectionBundleClientResult } from "@/lib/core/projection-client";
import { getDefaultProjectionBundle } from "@/lib/core/projection-defaults";

export function useProjectionBundle(refreshKey = 0) {
  const [state, setState] = useState<ProjectionBundleClientResult>(getDefaultProjectionBundle());
  const [refreshing, setRefreshing] = useState(true);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const bundle = await getProjectionBundle({ includeBinance: true });
      setState(bundle);
    } catch (err) {
      const fallback = getDefaultProjectionBundle();
      fallback.ok = false;
      fallback.errors = [
        {
          section: "bundle",
          code: "BUNDLE_FAILED",
          message: err instanceof Error ? err.message : "Projection bundle failed",
        },
      ];
      fallback.warnings = [fallback.errors[0].message];
      setState(fallback);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setRefreshing(true);
    const hardStop = setTimeout(() => {
      if (active) setRefreshing(false);
    }, 5_250);

    void getProjectionBundle({ includeBinance: true })
      .then((bundle) => {
        if (active) setState(bundle);
      })
      .catch((err) => {
        if (!active) return;
        const fallback = getDefaultProjectionBundle();
        fallback.ok = false;
        fallback.errors = [
          {
            section: "bundle",
            code: "BUNDLE_FAILED",
            message: err instanceof Error ? err.message : "Projection bundle failed",
          },
        ];
        fallback.warnings = [fallback.errors[0].message];
        setState(fallback);
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      clearTimeout(hardStop);
    };
  }, [refreshKey]);

  return {
    bundle: state,
    mission: state.mission,
    trades: state.trades,
    positions: state.positions,
    pnl: state.pnl,
    evidence: state.evidence,
    risk: state.risk,
    health: state.health,
    binanceStatus: state.binanceStatus,
    errors: state.errors,
    warnings: state.warnings,
    ok: state.ok,
    loadedAt: state.loadedAt,
    error: state.errors[0]?.message ?? null,
    loading: false,
    refreshing,
    reload,
  };
}
