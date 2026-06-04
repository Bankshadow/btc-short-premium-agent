"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  closePaperOrderAndSyncLog,
  tryAutoClosePaperOnSkip,
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
  fetchOpenPaperOrdersFromApi,
  pullPaperOrdersFromServer,
  syncOpenedPaperOrder,
  syncPaperOrdersToServer,
} from "@/lib/paper/paper-sync";
import { isHumanApprovalRequired } from "@/lib/trade-control/trade-control-settings";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { useCallback, useEffect, useMemo, useState } from "react";

export function usePaperTrading() {
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [settings, setSettings] = useState(loadPaperSettings);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncedOpenOrders, setSyncedOpenOrders] = useState<PaperOrder[]>([]);

  const refresh = useCallback(() => {
    setOrders(loadPaperOrders());
    setSettings(loadPaperSettings());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
    if (loadPaperSettings().syncSupabase) {
      void fetchOpenPaperOrdersFromApi().then(setSyncedOpenOrders);
    }
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
    const openFromApi = await fetchOpenPaperOrdersFromApi();
    if (openFromApi.length > 0) {
      mergePaperOrdersFromRemote(openFromApi);
      refresh();
      setSyncedOpenOrders(openFromApi);
    } else if (result.openOrders?.length) {
      setSyncedOpenOrders(result.openOrders);
    }
    setSyncStatus(
      result.ok
        ? `Synced ${result.synced} order(s) · ${openFromApi.length || result.openOrders?.length || 0} open on server`
        : result.error ?? "Sync failed",
    );
    return result;
  }, [settings, refresh]);

  const pullFromServer = useCallback(async () => {
    const remote = await pullPaperOrdersFromServer();
    if (remote.length > 0) {
      mergePaperOrdersFromRemote(remote);
      refresh();
      setSyncStatus(`Pulled ${remote.length} order(s) from cloud`);
    }
    const openFromApi = await fetchOpenPaperOrdersFromApi();
    setSyncedOpenOrders(openFromApi);
    return remote;
  }, [refresh]);

  const afterAnalysis = useCallback(
    async (
      data: AnalyzeApiResponse,
      decisionLogId: string,
      options?: { skipAutoOpen?: boolean },
    ) => {
      const btc = data.step1_marketSnapshot.spotPrice;
      const currentSettings = loadPaperSettings();

      if (currentSettings.autoMarkToMarket && btc > 0) {
        markOrdersToMarket(btc);
      }

      tryAutoClosePaperOnSkip(data);
      const gov = loadGovernanceState();
      const skipOpen =
        options?.skipAutoOpen ??
        (isHumanApprovalRequired() || gov.pausePaperAutoOpen);
      const opened = skipOpen
        ? null
        : tryAutoOpenPaperOrder(data, decisionLogId);

      refresh();

      if (opened && currentSettings.syncSupabase) {
        const syncResult = await syncOpenedPaperOrder(opened, currentSettings);
        if (syncResult.openOrders.length > 0) {
          mergePaperOrdersFromRemote(syncResult.openOrders);
          refresh();
          setSyncedOpenOrders(syncResult.openOrders);
        }
        setSyncStatus(
          syncResult.error
            ? `Opened ${opened.instrument} · sync: ${syncResult.error}`
            : `Opened & synced ${opened.instrument} · ${syncResult.openOrders.length} open on server`,
        );
      } else if (currentSettings.syncSupabase) {
        await syncPaperOrdersToServer({
          orders: loadPaperOrders(),
          settings: currentSettings,
        });
        const openFromApi = await fetchOpenPaperOrdersFromApi();
        setSyncedOpenOrders(openFromApi);
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
    syncedOpenOrders,
    refresh,
    updateSettings,
    afterAnalysis,
    closeOrder,
    syncToServer,
    pullFromServer,
    importOrders,
  };
}
