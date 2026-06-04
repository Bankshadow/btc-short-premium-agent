"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  closePaperOrderAndSyncLog,
  tryAutoOpenPaperOrder,
} from "@/lib/paper/paper-execution";
import {
  loadPaperOrders,
  loadPaperSettings,
  markOrdersToMarket,
  persistPaperOrders,
  savePaperSettings,
  summarizePaperPortfolio,
} from "@/lib/paper/paper-orders";
import type { PaperOrder, PaperTradingSettings } from "@/lib/paper/paper-order-types";
import { mergePaperOrdersFromRemote } from "@/lib/paper/paper-merge";
import {
  pullPaperOrdersFromServer,
  syncPaperOrdersToServer,
} from "@/lib/paper/paper-sync";
import { useCallback, useEffect, useMemo, useState } from "react";

export function usePaperTrading() {
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [settings, setSettings] = useState(loadPaperSettings);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setOrders(loadPaperOrders());
    setSettings(loadPaperSettings());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
  }, [refresh]);

  const summary = useMemo(() => summarizePaperPortfolio(orders), [orders]);

  const updateSettings = useCallback(
    (patch: Partial<PaperTradingSettings>) => {
      const next = savePaperSettings({ ...loadPaperSettings(), ...patch });
      setSettings(next);
      return next;
    },
    [],
  );

  const syncToServer = useCallback(async () => {
    if (!settings.syncSupabase) return;
    const result = await syncPaperOrdersToServer({
      orders: loadPaperOrders(),
      settings,
    });
    setSyncStatus(
      result.ok
        ? `Synced ${result.synced} order(s)`
        : result.error ?? "Sync failed",
    );
    return result;
  }, [settings]);

  const pullFromServer = useCallback(async () => {
    const remote = await pullPaperOrdersFromServer();
    if (remote.length > 0) {
      mergePaperOrdersFromRemote(remote);
      refresh();
      setSyncStatus(`Pulled ${remote.length} order(s) from cloud`);
    }
    return remote;
  }, [refresh]);

  const afterAnalysis = useCallback(
    async (data: AnalyzeApiResponse, decisionLogId: string) => {
      const btc = data.step1_marketSnapshot.spotPrice;
      const currentSettings = loadPaperSettings();

      if (currentSettings.autoMarkToMarket && btc > 0) {
        markOrdersToMarket(btc);
      }

      tryAutoOpenPaperOrder(data, decisionLogId);

      refresh();

      if (currentSettings.syncSupabase) {
        await syncPaperOrdersToServer({
          orders: loadPaperOrders(),
          settings: currentSettings,
        });
      }
    },
    [refresh],
  );

  const closeOrder = useCallback(
    async (
      orderId: string,
      input: { exitBtcPrice: number; notes?: string; tradeWouldWin?: boolean | null },
    ) => {
      const result = closePaperOrderAndSyncLog(orderId, input);
      refresh();
      if (settings.syncSupabase) {
        await syncPaperOrdersToServer({
          orders: loadPaperOrders(),
          settings,
        });
      }
      return result;
    },
    [refresh, settings],
  );

  const importOrders = useCallback((next: PaperOrder[]) => {
    persistPaperOrders(next);
    refresh();
  }, [refresh]);

  return {
    orders,
    openOrders: orders.filter((o) => o.status === "OPEN"),
    closedOrders: orders.filter((o) => o.status === "CLOSED"),
    settings,
    summary,
    hydrated,
    syncStatus,
    refresh,
    updateSettings,
    afterAnalysis,
    closeOrder,
    syncToServer,
    pullFromServer,
    importOrders,
  };
}
