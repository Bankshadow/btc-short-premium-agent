"use client";

import { useCallback, useEffect, useState } from "react";
import type { MissionControllerResult } from "@/lib/mission-controller/types";

type Response = {
  ok: boolean;
  controller?: MissionControllerResult;
  calibration?: { headline: string; recommendedSizeMultiplier: number } | null;
  error?: string;
};

export function useMissionController(pollMs = 8000) {
  const [controller, setController] = useState<MissionControllerResult | null>(null);
  const [calibration, setCalibration] = useState<Response["calibration"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/mission-controller/status", { cache: "no-store" });
      const json = (await res.json()) as Response;
      if (!res.ok || !json.ok || !json.controller) {
        throw new Error(json.error ?? "Mission controller failed");
      }
      setController(json.controller);
      setCalibration(json.calibration ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mission controller failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh]);

  return { controller, calibration, busy, error, refresh };
}
