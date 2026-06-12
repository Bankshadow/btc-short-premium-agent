"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { SafetyLabelsBar } from "@/components/ui";
import type { TerminalBundle } from "@/lib/terminal/terminal-types";
import {
  AgentDebatePanel,
  CommandCenterPanel,
  ConfigKillSwitchPanel,
  DecisionJournalPanel,
  MarketDataPanel,
  PaperBlotterPanel,
  PolymarketMispricingPanel,
  RiskGuardPanel,
  SweeperScannerPanel,
  SystemHealthPanel,
  TerminalStatusBar,
} from "@/components/terminal/terminal-sections";

interface TerminalBundleResponse {
  ok: boolean;
  bundle: TerminalBundle;
  error?: string;
}

export function TerminalClient({ initialBundle }: { initialBundle: TerminalBundle }) {
  const [bundle, setBundle] = useState(initialBundle);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<TerminalBundleResponse>("/api/terminal/bundle");
      if (res.bundle) setBundle(res.bundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshScans() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetchJson<TerminalBundleResponse>("/api/terminal/refresh", {
        method: "POST",
        body: "{}",
      });
      if (res.bundle) setBundle(res.bundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="terminal-root">
      <TerminalStatusBar bundle={bundle} />
      <SafetyLabelsBar />

      <div className="terminal-actions">
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void load()}>
          {loading ? "Refreshing…" : "Refresh terminal"}
        </button>
        <button type="button" className="btn" disabled={scanning} onClick={() => void refreshScans()}>
          {scanning ? "Running paper scan…" : "Run Polymarket paper scan"}
        </button>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {bundle.meta.warnings.length > 0 ? (
        <div className="terminal-warnings">
          {bundle.meta.warnings.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      ) : null}

      <div className="terminal-grid">
        <div className="terminal-grid-row terminal-grid-row--2">
          <CommandCenterPanel cc={bundle.commandCenter} />
          <MarketDataPanel md={bundle.marketData} />
        </div>
        <div className="terminal-grid-row terminal-grid-row--2">
          <PolymarketMispricingPanel rows={bundle.polymarketMispricing} />
          <SweeperScannerPanel rows={bundle.sweeperScanner} />
        </div>
        <AgentDebatePanel debate={bundle.agentDebate} />
        <div className="terminal-grid-row terminal-grid-row--2">
          <RiskGuardPanel rows={bundle.riskGuard} />
          <SystemHealthPanel health={bundle.systemHealth} />
        </div>
        <PaperBlotterPanel rows={bundle.paperBlotter} />
        <DecisionJournalPanel rows={bundle.decisionJournal} />
        <ConfigKillSwitchPanel config={bundle.configPanel} />
      </div>
    </div>
  );
}
