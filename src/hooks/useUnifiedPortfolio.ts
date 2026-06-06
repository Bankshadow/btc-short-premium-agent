"use client";

import { useCallback, useEffect, useState } from "react";
import { loadLedgerAnalyticsInput } from "@/lib/ledger/analytics";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { refreshDeskBackboneFromLegacy } from "@/lib/data-backbone/read-desk-state";
import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import {
  migratePerpPositionsInStorage,
  saveUnifiedPortfolioMeta,
  UNIFIED_PORTFOLIO_MIGRATION_VERSION,
} from "@/lib/portfolio/unified-migration";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";

export function useUnifiedPortfolio() {
  const [snapshot, setSnapshot] = useState<UnifiedPortfolioSnapshot | null>(
    null,
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    const analytics = loadLedgerAnalyticsInput();
    const { positions: perpPositions, changed } = migratePerpPositionsInStorage(
      analytics.riskProfile,
    );
    if (changed) {
      saveUnifiedPortfolioMeta({
        lastMigrationAt: new Date().toISOString(),
        perpMigrationVersion: UNIFIED_PORTFOLIO_MIGRATION_VERSION,
      });
    }

    refreshDeskBackboneFromLegacy();
    const built = buildUnifiedPortfolioSnapshot({
      entries: analytics.entries,
      orders: analytics.orders,
      perpPositions: perpPositions.length ? perpPositions : analytics.perpPositions,
      riskProfile: analytics.riskProfile,
    });
    setSnapshot(built);
    setHydrated(true);
    return built;
  }, []);

  const syncToServer = useCallback(async () => {
    setSyncing(true);
    setError(null);
    const analytics = loadLedgerAnalyticsInput();
    const body = {
      entries: analytics.entries,
      orders: analytics.orders,
      perpPositions: analytics.perpPositions,
      riskProfile: analytics.riskProfile,
    };

    try {
      const res = await fetch("/api/portfolio/paper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      if (data.snapshot) {
        setSnapshot(data.snapshot as UnifiedPortfolioSnapshot);
      }
      saveUnifiedPortfolioMeta({ lastSyncedAt: new Date().toISOString() });
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      setError(message);
      throw e;
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    snapshot,
    hydrated,
    syncing,
    error,
    refresh,
    syncToServer,
  };
}
