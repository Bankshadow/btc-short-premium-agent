"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyMissionFlowSnapshot } from "@/lib/mission-flow/empty-snapshot";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export function useMissionSnapshot() {
  const [snapshot, setSnapshot] = useState<MissionFlowSnapshot>(emptyMissionFlowSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const refresh = useCallback(async (fresh = false) => {
    setBusy(true);
    setError(null);
    try {
      const url = fresh ? "/api/mission/snapshot?fresh=1" : "/api/mission/snapshot";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.snapshot) {
        throw new Error(json.error ?? "Failed to load mission snapshot");
      }
      setSnapshot(json.snapshot as MissionFlowSnapshot);
      setDegraded(Boolean(json.degraded));
      setWarnings(Array.isArray(json.warnings) ? json.warnings : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mission snapshot");
      setDegraded(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    snapshot,
    busy,
    error,
    degraded,
    warnings,
    refresh,
    setSnapshot,
  };
}
