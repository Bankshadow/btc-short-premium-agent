"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getProjectionBundle, type ProjectionBundleClientResult } from "@/lib/core/projection-client";
import {
  DASHBOARD_RENDER_DEADLINE_MS,
  getDefaultProjectionBundle,
  PROJECTION_UNAVAILABLE_MESSAGE,
} from "@/lib/core/projection-defaults";

function applyBundleFailure(err: unknown): ProjectionBundleClientResult {
  const fallback = getDefaultProjectionBundle();
  fallback.ok = false;
  fallback.errors = [
    {
      section: "bundle",
      code: "BUNDLE_FAILED",
      message: err instanceof Error ? err.message : "Projection bundle failed",
    },
  ];
  fallback.warnings = [PROJECTION_UNAVAILABLE_MESSAGE, fallback.errors[0].message];
  fallback.loadedAt = new Date().toISOString();
  return fallback;
}

export function useProjectionBundle(refreshKey = 0) {
  const initial = useMemo(() => getDefaultProjectionBundle(), []);
  const [state, setState] = useState<ProjectionBundleClientResult>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const reload = useCallback(async () => {
    setRefreshing(true);
    setTimedOut(false);
    try {
      const bundle = await getProjectionBundle({ includeBinance: true });
      setState(bundle);
      setTimedOut(false);
    } catch (err) {
      setState(applyBundleFailure(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setRefreshing(true);
    setTimedOut(false);

    const hardStop = setTimeout(() => {
      if (!active) return;
      setTimedOut(true);
      setRefreshing(false);
      setState((prev) => {
        if (prev.ok) return prev;
        const fallback = getDefaultProjectionBundle();
        fallback.ok = false;
        fallback.errors = prev.errors.length
          ? prev.errors
          : [
              {
                section: "bundle",
                code: "BUNDLE_TIMEOUT",
                message: "Projection bundle fetch exceeded deadline",
              },
            ];
        fallback.warnings = [PROJECTION_UNAVAILABLE_MESSAGE, ...prev.warnings];
        fallback.loadedAt = new Date().toISOString();
        return fallback;
      });
    }, DASHBOARD_RENDER_DEADLINE_MS);

    void getProjectionBundle({ includeBinance: true })
      .then((bundle) => {
        if (!active) return;
        setState(bundle);
        setTimedOut(false);
      })
      .catch((err) => {
        if (!active) return;
        setState(applyBundleFailure(err));
      })
      .finally(() => {
        if (!active) return;
        setRefreshing(false);
        clearTimeout(hardStop);
      });

    return () => {
      active = false;
      clearTimeout(hardStop);
    };
  }, [refreshKey]);

  const warnings = useMemo(() => {
    if (timedOut && !state.ok) {
      return [PROJECTION_UNAVAILABLE_MESSAGE, ...state.warnings];
    }
    return state.warnings;
  }, [state.ok, state.warnings, timedOut]);

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
    warnings,
    ok: state.ok,
    loadedAt: state.loadedAt,
    error: state.errors[0]?.message ?? null,
    loading: false,
    refreshing,
    timedOut,
    reload,
  };
}
