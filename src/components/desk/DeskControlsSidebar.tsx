"use client";

import LiveSpotPrices from "@/components/dashboard/LiveSpotPrices";
import AnalysisAlerts from "@/components/dashboard/AnalysisAlerts";
import type { DataSourceError } from "@/lib/types/market";

interface DeskControlsSidebarProps {
  fetchError: string | null;
  sourceErrors: DataSourceError[];
}

export default function DeskControlsSidebar({
  fetchError,
  sourceErrors,
}: DeskControlsSidebarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="desk-panel px-3 py-2">
        <p className="desk-section-title">Desk controls</p>
        <p className="mt-1 text-xs text-zinc-500">
          Live spot tape · desk refreshes on the timer above
        </p>
      </div>

      <div className="[&_.desk-panel]:border-zinc-800 [&_section]:rounded-lg [&_section]:border [&_section]:border-zinc-800 [&_section]:bg-zinc-950/80">
        <LiveSpotPrices />
      </div>

      <AnalysisAlerts fetchError={fetchError} sourceErrors={sourceErrors} />
    </div>
  );
}
