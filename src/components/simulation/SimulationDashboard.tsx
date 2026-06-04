"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OpsShell from "@/components/ops/OpsShell";
import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadDraftRules } from "@/lib/journal/draft-rules";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import type {
  CapitalRiskSimulatorOutput,
  DrawdownSimulatorOutput,
  MilestoneProjectionOutput,
  RuleImpactSimulatorOutput,
} from "@/lib/simulation/types";

interface SimulationPayload {
  capitalRisk: CapitalRiskSimulatorOutput;
  milestone: MilestoneProjectionOutput;
  drawdown: DrawdownSimulatorOutput;
  derivedStats: { resolvedCount: number; avgR: number; winRate: number };
  aggressiveModeSafe: boolean;
}

export default function SimulationDashboard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sim, setSim] = useState<SimulationPayload | null>(null);
  const [ruleImpact, setRuleImpact] = useState<RuleImpactSimulatorOutput | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [riskPct, setRiskPct] = useState(2);

  const rules = loadDraftRules();

  const runSimulation = useCallback(async () => {
    setBusy(true);
    setError(null);
    const entries = loadDecisionLog();
    const orders = loadPaperOrders();
    const profile = loadDeskSettings().riskProfile;
    const body = {
      entries,
      orders,
      riskPerTradePct: riskPct,
      maxDrawdownPct: profile === "aggressive" ? 15 : 12,
    };

    try {
      const res = await fetch("/api/simulation/capital-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSim(data as SimulationPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }, [riskPct]);

  const runRuleImpact = async () => {
    const rule = rules.find((r) => r.id === selectedRuleId);
    if (!rule) return;
    const res = await fetch("/api/simulation/rule-impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule: { id: rule.id, title: rule.title, description: rule.description },
        entries: loadDecisionLog(),
        orders: loadPaperOrders(),
      }),
    });
    const data = await res.json();
    if (res.ok) setRuleImpact(data as RuleImpactSimulatorOutput);
  };

  useEffect(() => {
    void runSimulation();
    const r = loadDraftRules();
    if (r[0] && !selectedRuleId) setSelectedRuleId(r[0].id);
  }, [runSimulation, selectedRuleId]);

  const cr = sim?.capitalRisk;

  return (
    <OpsShell
      badge="MVP 19 · Advisory only"
      title="Capital & Rule Simulation"
      subtitle="Monte Carlo ruin paths, milestone odds, drawdown stress, and draft-rule backtest on decision log. No fund movement or live execution."
      accent="violet"
      iconLetters="SIM"
      activePath="/simulation"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/capital", label: "Capital mission", primary: true },
        { href: "/war-room", label: "War room" },
      ]}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void runSimulation()}
          className="rounded-lg bg-violet-700/90 px-4 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
        >
          {busy ? "Simulating…" : "Run simulation"}
        </button>
      }
    >
      <p className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-4 py-2 text-xs text-violet-200/80">
        Simulator output is advisory only — cannot auto-change risk profile or promote rules.
      </p>

      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Capital risk simulator</h2>
        <label className="mt-3 block text-xs text-zinc-500">
          Risk per trade (%)
          <input
            type="number"
            min={0.5}
            max={5}
            step={0.25}
            value={riskPct}
            onChange={(e) => setRiskPct(Number(e.target.value))}
            className="mt-1 w-24 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm text-zinc-100"
          />
        </label>
        {cr && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Reach $20k" value={`${cr.probabilityReachTarget}%`} />
            <Metric label="Ruin risk" value={`${cr.probabilityRuin}%`} />
            <Metric label="Median equity" value={`$${cr.medianEndingEquity.toLocaleString()}`} />
            <Metric label="E[max DD]" value={`${cr.expectedMaxDrawdown}%`} />
            <Metric label="Recommended risk" value={`${cr.recommendedRiskPct}%`} />
            <Metric label="Confidence" value={cr.confidence} />
            <Metric label="Best / worst" value={`$${cr.bestCaseEquity} / $${cr.worstCaseEquity}`} />
            <Metric
              label="Aggressive safe"
              value={sim?.aggressiveModeSafe ? "Yes" : "No"}
              warn={!sim?.aggressiveModeSafe}
            />
          </div>
        )}
        {cr?.warnings.map((w) => (
          <p key={w} className="mt-2 text-xs text-amber-300/90">
            ⚠ {w}
          </p>
        ))}
      </section>

      {sim?.milestone && (
        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Milestone projection</h2>
          <p className="mt-2 text-sm text-zinc-300">
            {sim.milestone.currentStageLabel} · next $
            {sim.milestone.nextMilestoneUsd?.toLocaleString() ?? "20k+"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            ~{sim.milestone.estimatedTradesToNext ?? "—"} trades · P(next){" "}
            {sim.milestone.probabilityNextMilestone}% · risk {sim.milestone.riskLevel}
          </p>
          <p className="mt-2 text-[11px] text-zinc-600">
            Split: R{sim.milestone.recommendedSplit.reservePct}% / C
            {sim.milestone.recommendedSplit.coreStrategyPct}% / G
            {sim.milestone.recommendedSplit.growthStrategyPct}% —{" "}
            {sim.milestone.recommendedSplit.note}
          </p>
        </section>
      )}

      {sim?.drawdown && (
        <section className="desk-panel px-5 py-4">
          <h2 className="desk-section-title">Drawdown stress test</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {sim.drawdown.results.map((r) => (
              <div
                key={r.scenarioId}
                className="rounded border border-zinc-800 px-3 py-2 text-[11px]"
              >
                <p className="font-medium text-zinc-300">{r.label}</p>
                <p className="text-zinc-500">
                  End ${r.endingEquity.toLocaleString()} · DD {r.drawdownPct}%
                  {r.killSwitchTrigger ? " · KILL" : ""}
                </p>
                <p className="text-zinc-600">{r.cooldownRecommendation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="desk-panel px-5 py-4">
        <h2 className="desk-section-title">Rule impact simulator</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={selectedRuleId}
            onChange={(e) => setSelectedRuleId(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          >
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runRuleImpact()}
            className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-300"
          >
            Simulate rule
          </button>
          <Link href="/" className="text-xs text-violet-400 hover:underline">
            Manage draft rules on desk
          </Link>
        </div>
        {ruleImpact && (
          <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-[11px]">
            <p className="font-semibold text-zinc-200">
              {ruleImpact.recommendation.replace(/_/g, " ")}
            </p>
            <p className="mt-2 text-zinc-400">{ruleImpact.explanation}</p>
            <p className="mt-2 text-zinc-500">
              Blocked {ruleImpact.affectedDecisions} · losses avoided{" "}
              {ruleImpact.blockedLosingTrades} · wins missed{" "}
              {ruleImpact.blockedWinningTrades} · net {ruleImpact.netImpactR}R
            </p>
          </div>
        )}
      </section>
    </OpsShell>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className={`font-mono text-sm font-semibold ${warn ? "text-rose-400" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}
