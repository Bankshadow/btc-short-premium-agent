"use client";

import { useCallback, useEffect, useState } from "react";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import type { RegimeBrainReport } from "@/lib/market-regime-brain/types";
import { REGIME_BRAIN_SAFETY_NOTICE } from "@/lib/market-regime-brain/types";
import {
  appendRegimeHistory,
  loadRegimeHistory,
} from "@/lib/market-regime-brain/regime-history-store";
import type { LiveMarketResponse, SpotQuote } from "@/lib/types/market";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function fetchEthQuote(): Promise<SpotQuote | undefined> {
  try {
    const response = await fetch("/api/market", { cache: "no-store" });
    if (!response.ok) return undefined;
    const data = (await response.json()) as LiveMarketResponse;
    return data.eth?.price > 0 ? data.eth : undefined;
  } catch {
    return undefined;
  }
}

export default function MarketRegimeBrainDashboard() {
  const [report, setReport] = useState<RegimeBrainReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const entries = loadDecisionLog();
      const ethQuote = await fetchEthQuote();
      const res = await fetch("/api/market-regime-brain/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, ethQuote }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      const next = data.report as RegimeBrainReport;
      setReport(next);
      if (next.current) {
        appendRegimeHistory(next.current, entries[0]?.btcPrice ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detect failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = report?.current;
  const history = loadRegimeHistory();

  return (
    <OpsShell
      badge="Regime Brain"
      title="Market Regime Brain"
      subtitle="Deep regime classification with evidence-based strategy routing — advisory only."
      accent="indigo"
      iconLetters="RB"
      activePath="/regime-brain"
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-indigo-800 bg-indigo-950/40 px-4 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-900/40 disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Refresh regime"}
        </button>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">{REGIME_BRAIN_SAFETY_NOTICE}</p>
      {error && (
        <p className="mb-4 rounded border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Primary regime"
          value={current?.primaryRegime ?? "—"}
          hint={current?.deskLabel}
        />
        <OpsKpi
          label="Confidence"
          value={current ? `${current.regimeConfidence}%` : "—"}
          hint={
            current?.secondaryRegimes.length
              ? `Also: ${current.secondaryRegimes.join(", ")}`
              : undefined
          }
        />
        <OpsKpi
          label="Sizing multiplier"
          value={current ? `×${current.sizingMultiplier}` : "—"}
          hint={current?.tradeFrequencyRecommendation}
        />
        <OpsKpi
          label="Recommended"
          value={String(current?.recommendedStrategies.length ?? 0)}
          hint={current?.recommendedStrategies.join(", ") || "none"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Current market regime">
          {current ? (
            <div className="space-y-2 text-sm text-zinc-300">
              <p className="text-lg font-semibold text-indigo-200">
                {current.primaryRegime}
              </p>
              <p className="text-xs text-zinc-500">
                Canonical: {current.canonicalRegime} · {current.deskLabel}
              </p>
              {current.regimeRisks.map((r) => (
                <p key={r} className="text-xs text-amber-300/90">
                  {r}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Run detect to classify regime.</p>
          )}
        </Panel>

        <Panel title="Regime evidence">
          {current?.evidence.length ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-400">
              {current.evidence.map((ev) => (
                <li key={`${ev.signal}-${ev.value}-${ev.supports}`}>
                  <span className="text-indigo-300">{ev.supports}</span> · {ev.signal}:{" "}
                  {ev.value} (w={ev.weight})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No evidence yet.</p>
          )}
        </Panel>

        <Panel title="Strategy routing">
          {current ? (
            <div className="space-y-2 text-xs text-zinc-400">
              <p>
                <span className="text-emerald-300">Recommended:</span>{" "}
                {current.recommendedStrategies.join(", ") || "none"}
              </p>
              <p>
                Frequency: {current.tradeFrequencyRecommendation} · sizing ×
                {current.sizingMultiplier}
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">—</p>
          )}
        </Panel>

        <Panel title="Blocked strategies">
          {current?.blockedStrategies.length ? (
            <ul className="space-y-1 text-xs text-rose-300/90">
              {current.blockedStrategies.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No strategies blocked for this regime.</p>
          )}
        </Panel>

        <Panel title="Regime history">
          {history.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-zinc-500">
              {history.slice(0, 12).map((h) => (
                <li key={h.id}>
                  {new Date(h.timestamp).toLocaleString()} · {h.primaryRegime} (
                  {h.confidence}%)
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">History builds on each refresh.</p>
          )}
        </Panel>

        <Panel title="Regime performance">
          {report?.regimePerformance.length ? (
            <ul className="space-y-1 text-xs text-zinc-400">
              {report.regimePerformance.map((r) => (
                <li key={r.regime}>
                  {r.label}: {r.winRate}% win · n={r.resolved} · net {r.netPnlPct}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">
              Resolve trades to see performance by regime.
            </p>
          )}
        </Panel>
      </div>
    </OpsShell>
  );
}
