"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdvancedModuleId, AdvancedModuleStatus } from "@/lib/advanced-modules/types";

export function useAdvancedModuleStatus(moduleId: AdvancedModuleId) {
  const [status, setStatus] = useState<AdvancedModuleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advanced/modules/${moduleId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok: boolean;
        module?: AdvancedModuleStatus | null;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Failed to load module status");
        setStatus(null);
      } else {
        setStatus(data.module ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load module status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
