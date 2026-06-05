"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { loadOptionsDryRunHistory } from "@/lib/options-dry-run/dry-run-client-store";
import { loadOptionsPreviewJournal } from "@/lib/options-execution/preview-journal-store";
import { OPTIONS_RISK_GREEKS_SAFETY_NOTICE } from "@/lib/options-risk-greeks/types";
import type { OptionsRiskReport } from "@/lib/options-risk-greeks/types";
import { loadPaperOrders } from "@/lib/paper/paper-orders";

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

function checkStatusClass(status: string): string {
  if (status === "PASS") return "text-emerald-400";
  if (status === "WARNING") return "text-amber-400";
  if (status === "FAIL") return "text-rose-400";
  return "text-zinc-400";
}

export default function OptionsRiskDashboard() {
  const [report, setReport] = useState<OptionsRiskReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stressMsg, setStressMsg] = useState<string | null>(null);

  const clientPayload = useCallback(
    () => ({
      paperOrders: loadPaperOrders(),
      dryRunHistory: loadOptionsDryRunHistory(),
      preview: loadOptionsPreviewJournal().at(-1) ?? null,
    }),
    [],
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/options/risk-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setReport(data.report as OptionsRiskReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }, [clientPayload]);

  const runStressTest = async () => {
    setBusy(true);
    setStressMsg(null);
    try {
      const res = await fetch("/api/options/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientPayload(),
          priceMovesPct: [-15, -10, -5, 5, 10, 15],
          volExpansionPct: [20, 50, 80],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Stress test failed");
      setReport(data.report as OptionsRiskReport);
      setStressMsg(`Stress test complete — ${data.stressScenarios?.length ?? 0} scenarios.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stress test failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 45_000);
    return () => clearInterval(id);
  }, [refresh]);

  const p = report?.portfolio;

  return (
    <OpsShell
      badge="MVP 45 · Greeks & margin"
      title="BTC Options Portfolio Risk"
      subtitle="Portfolio-level Greeks, margin estimates, and stress scenarios — read-only, no order placement."
      accent="violet"
      iconLetters="GR"
      activePath="/options-risk"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/options-dry-run", label: "Dry-run" },
        { href: "/options-live-readiness", label: "Live ready" },
        { href: "/real-time-risk", label: "Risk RT", primary: true },
      ]}
    >
      <p className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-4 py-2 text-xs text-violet-200/80">
        {OPTIONS_RISK_GREEKS_SAFETY_NOTICE}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border border-violet-800/60 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
        >
          {busy ? "Loading…" : "Refresh risk report"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runStressTest()}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Run stress test
        </button>
      </div>

      {error && (
        <p className="rounded border border-rose-900/50 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {stressMsg && (
        <p className="rounded border border-emerald-900/40 px-3 py-2 text-xs text-emerald-300">
          {stressMsg}
        </p>
      )}

      {report && (
        <>
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              report.overallStatus === "PASS"
                ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-300"
                : report.overallStatus === "WARNING"
                  ? "border-amber-800/50 bg-amber-950/30 text-amber-300"
                  : "border-rose-800/50 bg-rose-950/30 text-rose-300"
            }`}
          >
            {report.overallStatus}
            {report.liveReadinessBlocked ? " — live options readiness blocked" : ""}
            {report.spotPrice != null ? ` · spot $${report.spotPrice.toLocaleString()}` : ""}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <OpsKpi label="Positions" value={String(p?.positionCount ?? 0)} hint="Greek snapshots" />
            <OpsKpi label="Net Δ" value={String(p?.netDelta ?? 0)} hint="Portfolio delta" />
            <OpsKpi label="Net Γ" value={String(p?.netGamma ?? 0)} hint="Portfolio gamma" />
            <OpsKpi label="Θ / day" value={String(p?.netThetaPerDay ?? 0)} hint="Theta decay" />
            <OpsKpi label="Net V" value={String(p?.netVega ?? 0)} hint="Vega exposure" />
            <OpsKpi
              label="Margin"
              value={
                report.margin.marginUsagePct != null
                  ? `${report.margin.marginUsagePct}%`
                  : "n/a"
              }
              hint={`$${report.margin.totalMarginUsd} est.`}
            />
            <OpsKpi
              label="Greeks"
              value={report.greeksEstimable ? "OK" : "MISSING"}
              hint={`${p?.estimablePositionCount ?? 0} estimable`}
            />
            <OpsKpi
              label="Margin est."
              value={report.marginEstimable ? "OK" : "MISSING"}
              hint={report.margin.sufficient === false ? "Insufficient" : "Readiness gate"}
            />
          </div>

          {report.blockers.length > 0 && (
            <Panel title="Blockers">
              <ul className="list-disc space-y-1 pl-4 text-xs text-rose-300/90">
                {report.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Risk checks">
            <ul className="space-y-2 text-xs">
              {report.checks.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap gap-2 rounded border border-zinc-800 px-3 py-2"
                >
                  <span className={checkStatusClass(c.status)}>{c.status}</span>
                  <span className="font-medium text-zinc-200">{c.label}</span>
                  <span className="text-zinc-500">{c.message}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {p && p.byPosition.length > 0 && (
            <Panel title="Greeks by position">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="py-1 pr-2">Symbol</th>
                      <th className="py-1 pr-2">Src</th>
                      <th className="py-1 pr-2">Δ</th>
                      <th className="py-1 pr-2">Γ</th>
                      <th className="py-1 pr-2">Θ</th>
                      <th className="py-1 pr-2">V</th>
                      <th className="py-1 pr-2">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.byPosition.map((pos) => (
                      <tr key={pos.positionId} className="border-t border-zinc-800/80 text-zinc-300">
                        <td className="py-1 pr-2">{pos.symbol}</td>
                        <td className="py-1 pr-2">{pos.source}</td>
                        <td className="py-1 pr-2">{pos.delta}</td>
                        <td className="py-1 pr-2">{pos.gamma}</td>
                        <td className="py-1 pr-2">{pos.theta}</td>
                        <td className="py-1 pr-2">{pos.vega}</td>
                        <td className="py-1 pr-2">${pos.marginUsd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {p && p.byExpiry.length > 0 && (
            <Panel title="Greeks by expiry">
              <ul className="space-y-1 text-xs text-zinc-400">
                {p.byExpiry.map((e) => (
                  <li key={e.expiry}>
                    <span className="text-zinc-200">{e.expiry}</span> — Δ {e.netDelta}, Γ{" "}
                    {e.netGamma}, Θ {e.netTheta}, V {e.netVega} ({e.positionCount} pos)
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {p && p.byStrike.length > 0 && (
            <Panel title="Greeks by strike">
              <ul className="space-y-1 text-xs text-zinc-400">
                {p.byStrike.map((s) => (
                  <li key={s.strike}>
                    <span className="text-zinc-200">${s.strike.toLocaleString()}</span> — Δ{" "}
                    {s.netDelta}, Γ {s.netGamma} ({s.positionCount} pos)
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {report.stressScenarios.length > 0 && (
            <Panel title="Stress scenarios">
              <ul className="space-y-1 text-xs text-zinc-400">
                {report.stressScenarios.map((s) => (
                  <li key={s.id}>
                    <span className="text-zinc-200">{s.label}</span> — PnL ${s.stressPnlUsd}{" "}
                    ({s.stressPnlPct}%) · {s.description}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Link href="/options-live-readiness" className="text-xs text-violet-400 hover:underline">
            Options live readiness uses Greeks & margin gates →
          </Link>
        </>
      )}
    </OpsShell>
  );
}
