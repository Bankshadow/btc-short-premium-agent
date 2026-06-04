"use client";

import { useEffect, useRef } from "react";

/**
 * Re-runs desk when config changes (macro / overrides), after controls hydrate.
 * Skips the first snapshot so boot analyze is not duplicated.
 */
export function useDebouncedConfigRerun(
  configKey: string,
  onRerun: () => void,
  options?: { debounceMs?: number; ready?: boolean },
) {
  const debounceMs = options?.debounceMs ?? 900;
  const ready = options?.ready ?? true;
  const initialized = useRef(false);
  const prevKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!initialized.current) {
      initialized.current = true;
      prevKey.current = configKey;
      return;
    }

    if (prevKey.current === configKey) return;
    prevKey.current = configKey;

    const timer = window.setTimeout(() => onRerun(), debounceMs);
    return () => clearTimeout(timer);
  }, [configKey, ready, debounceMs, onRerun]);
}
