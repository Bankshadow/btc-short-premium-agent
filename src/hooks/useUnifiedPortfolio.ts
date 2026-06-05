"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
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
    const settings = loadDeskSettings();
    const { positions: perpPositions, changed } = migratePerpPositionsInStorage(
      settings.riskProfile,
    );
    if (changed) {
      saveUnifiedPortfolioMeta({
        lastMigrationAt: new Date().toISOString(),
        perpMigrationVersion: UNIFIED_PORTFOLIO_MIGRATION_VERSION,
      });
    }

    const built = buildUnifiedPortfolioSnapshot({
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      perpPositions: perpPositions.length ? perpPositions : loadPerpPositions(),
      riskProfile: settings.riskProfile,
    });
    setSnapshot(built);
    setHydrated(true);
    return built;
  }, []);

  const syncToServer = useCallback(async () => {
    setSyncing(true);
    setError(null);
    const settings = loadDeskSettings();
    const body = {
      entries: loadDecisionLog(),
      orders: loadPaperOrders(),
      perpPositions: loadPerpPositions(),
      riskProfile: settings.riskProfile,
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
