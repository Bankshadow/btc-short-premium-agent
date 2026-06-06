"use client";

import { useCallback, useEffect, useState } from "react";
import { loadDeskBackbone, refreshDeskBackboneFromLegacy } from "@/lib/data-backbone/read-desk-state";
import { writeDeskCycle } from "@/lib/data-backbone/write-desk-cycle";
import type { DeskBackboneRecord, WriteDeskCycleInput } from "@/lib/data-backbone/types";

export function useDeskBackbone() {
  const [record, setRecord] = useState<DeskBackboneRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    const next = loadDeskBackbone();
    setRecord(next);
    setHydrated(true);
    return next;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const writeCycle = useCallback(async (input?: WriteDeskCycleInput) => {
    const result = await writeDeskCycle(input);
    if (result.record) {
      setRecord(result.record);
    } else {
      refresh();
    }
    return result;
  }, [refresh]);

  const rebuild = useCallback(() => {
    const next = refreshDeskBackboneFromLegacy();
    setRecord(next);
    return next;
  }, []);

  return {
    record,
    health: record?.health ?? null,
    portfolio: record?.portfolio ?? null,
    learning: record?.learning ?? null,
    risk: record?.risk ?? null,
    actions: record?.actions ?? [],
    hydrated,
    refresh,
    writeCycle,
    rebuild,
  };
}
