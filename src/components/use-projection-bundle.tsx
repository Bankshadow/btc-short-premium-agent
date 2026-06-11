"use client";

import { useApi } from "@/components/use-api";
import type { ProjectionBundleResponse } from "@/lib/core/projection-bundle-shared";
import { zeroProjectionBundle } from "@/lib/core/projection-bundle-shared";

export function useProjectionBundle(refreshKey = 0) {
  const { data, error, loading, reload } = useApi<ProjectionBundleResponse>(
    "/api/core/projections/bundle",
    refreshKey,
  );

  const bundle = data ?? (error ? { ...zeroProjectionBundle(), ok: false as const, error, health: null, meta: { eventCount: 0, builtAt: new Date().toISOString(), cacheKey: "error" as const } } : null);

  return {
    bundle,
    error,
    loading,
    reload,
    mission: bundle?.mission ?? zeroProjectionBundle().mission,
    trades: bundle?.trades ?? zeroProjectionBundle().trades,
    positions: bundle?.positions ?? zeroProjectionBundle().positions,
    pnl: bundle?.pnl ?? zeroProjectionBundle().pnl,
    evidence: bundle?.evidence ?? zeroProjectionBundle().evidence,
    risk: bundle?.risk ?? zeroProjectionBundle().risk,
    health: bundle?.health ?? null,
    ok: bundle?.ok ?? false,
  };
}
