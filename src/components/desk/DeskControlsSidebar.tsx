"use client";

import LiveSpotPrices from "@/components/dashboard/LiveSpotPrices";
import MacroEventToggle from "@/components/dashboard/MacroEventToggle";
import ManualOverridesPanel from "@/components/dashboard/ManualOverridesPanel";
import type { MacroEventSelection } from "@/lib/decision/macro-event";
import type { DerivativesOverrideFormValues } from "@/lib/decision/derivatives-overrides";
import AnalysisAlerts from "@/components/dashboard/AnalysisAlerts";
import type { DataSourceError } from "@/lib/types/market";

interface DeskControlsSidebarProps {
  macroEventSelection: MacroEventSelection;
  onMacroChange: (v: MacroEventSelection) => void;
  overrideValues: DerivativesOverrideFormValues;
  onOverrideChange: (v: DerivativesOverrideFormValues) => void;
  fetchError: string | null;
  sourceErrors: DataSourceError[];
}

export default function DeskControlsSidebar({
  macroEventSelection,
  onMacroChange,
  overrideValues,
  onOverrideChange,
  fetchError,
  sourceErrors,
}: DeskControlsSidebarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="desk-panel px-3 py-2">
        <p className="desk-section-title">Desk controls</p>
        <p className="mt-1 text-xs text-zinc-500">
          Macro & overrides re-run the desk in ~1s
        </p>
      </div>

      <div className="[&_.desk-panel]:border-zinc-800 [&_section]:rounded-lg [&_section]:border [&_section]:border-zinc-800 [&_section]:bg-zinc-950/80">
        <LiveSpotPrices />
      </div>

      <MacroEventToggle
        value={macroEventSelection}
        onChange={onMacroChange}
      />
      <ManualOverridesPanel
        values={overrideValues}
        onChange={onOverrideChange}
      />

      <AnalysisAlerts fetchError={fetchError} sourceErrors={sourceErrors} />
    </div>
  );
}
