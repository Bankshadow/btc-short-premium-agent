"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyMissionFlowSnapshot } from "@/lib/mission-flow/empty-snapshot";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export function useMissionSnapshot() {
  const [snapshot, setSnapshot] = useState<MissionFlowSnapshot>(emptyMissionFlowSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mission/snapshot", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.error ?? "Failed to load mission snapshot");
      }
      setSnapshot(json.snapshot as MissionFlowSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mission snapshot");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, busy, error, refresh, setSnapshot };
}
