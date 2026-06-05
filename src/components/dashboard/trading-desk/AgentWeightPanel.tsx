"use client";

import { useCallback, useState } from "react";
import type { WeightedCommitteeVerdict } from "@/lib/adaptive-agent-weighting/types";
import { ADAPTIVE_WEIGHTING_SAFETY_NOTICE } from "@/lib/adaptive-agent-weighting/types";
import {
  loadAdaptiveWeightingSettings,
  saveAdaptiveWeightingSettings,
  loadAdaptiveWeightingAudit,
} from "@/lib/adaptive-agent-weighting";
import type { CommitteeVerdict } from "@/lib/agents/types";

interface AgentWeightPanelProps {
  committee: CommitteeVerdict;
  weighted?: WeightedCommitteeVerdict | null;
  marketRegime: string;
}

function verdictColor(v: string): string {
  if (v === "TRADE") return "text-emerald-400";
  if (v === "SKIP") return "text-rose-400";
  return "text-amber-300";
}

export default function AgentWeightPanel({
  committee,
  weighted,
  marketRegime,
}: AgentWeightPanelProps) {
  const [settings, setSettings] = useState(loadAdaptiveWeightingSettings);
  const [showSettings, setShowSettings] = useState(false);
  const audit = loadAdaptiveWeightingAudit();

  const patchSettings = useCallback(
    (patch: Parameters<typeof saveAdaptiveWeightingSettings>[0]) => {
      const next = saveAdaptiveWeightingSettings(patch);
      setSettings(next);
    },
    [],
  );

  return (
    <section className="desk-panel border-violet-900/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="desk-section-title text-violet-400/80">
            Adaptive agent weighting
          </p>
          <p className="mt-1 text-xs text-zinc-500">{ADAPTIVE_WEIGHTING_SAFETY_NOTICE}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          {showSettings ? "Hide settings" : "Settings"}
        </button>
      </div>

      {showSettings && (
        <div className="mt-4 grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs sm:grid-cols-2">
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={settings.adaptiveWeightingEnabled}
              onChange={(e) =>
                patchSettings({ adaptiveWeightingEnabled: e.target.checked })
              }
            />
            Enable adaptive weighting (paper desk)
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={settings.paperOnlyAdaptiveMode}
              onChange={(e) =>
                patchSettings({ paperOnlyAdaptiveMode: e.target.checked })
              }
            />
            Paper-only mode (default on)
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={settings.liveAdaptiveApproval}
              onChange={(e) =>
                patchSettings({ liveAdaptiveApproval: e.target.checked })
              }
              disabled={settings.paperOnlyAdaptiveMode}
            />
            Live adaptive approval (explicit)
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Min closed trades
            <input
              type="number"
              min={1}
              max={50}
              value={settings.minClosedTradesBeforeWeighting}
              onChange={(e) =>
                patchSettings({
                  minClosedTradesBeforeWeighting: Number(e.target.value) || 5,
                })
              }
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Max weight multiplier
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              value={settings.maxWeightMultiplier}
              onChange={(e) =>
                patchSettings({
                  maxWeightMultiplier: Number(e.target.value) || 2,
                })
              }
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Recent performance lookback
            <input
              type="number"
              min={3}
              max={30}
              value={settings.recentPerformanceLookback}
              onChange={(e) =>
                patchSettings({
                  recentPerformanceLookback: Number(e.target.value) || 10,
                })
              }
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
            />
          </label>
        </div>
      )}

      {!settings.adaptiveWeightingEnabled && (
        <p className="mt-4 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-500">
          Adaptive weighting is off. Enable in settings and re-run analysis to
          compare weighted vs majority committee verdict.
        </p>
      )}

      {settings.adaptiveWeightingEnabled && !weighted && (
        <p className="mt-4 rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
          Not enough resolved trades yet (need{" "}
          {settings.minClosedTradesBeforeWeighting}+). Re-run after more paper
          closes are evaluated on /learning.
        </p>
      )}

      {weighted && (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="desk-section-title">Weighted vs original verdict</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">Majority</p>
                  <p
                    className={`text-2xl font-black ${verdictColor(committee.finalVerdict)}`}
                  >
                    {committee.finalVerdict}
                  </p>
                </div>
                <span className="text-zinc-600">→</span>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">Weighted</p>
                  <p
                    className={`text-2xl font-black ${verdictColor(weighted.weightedVerdict)}`}
                  >
                    {weighted.weightedVerdict}
                  </p>
                </div>
                {weighted.verdictDiffers && (
                  <span className="rounded bg-violet-950 px-2 py-1 text-xs font-semibold text-violet-300 ring-1 ring-violet-800">
                    DIFFERS
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-zinc-400">{weighted.explanation}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>Disagreement {weighted.disagreementScore}</span>
                <span>Confidence adj {weighted.confidenceAdjustment}</span>
                <span>
                  Scores T{weighted.tradeScore} / S{weighted.skipScore} / W
                  {weighted.waitScore}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="desk-section-title">Reason trail</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-400">
                {weighted.reasonTrail.map((line) => (
                  <li key={line} className="border-l-2 border-violet-900/50 pl-2">
                    {line}
                  </li>
                ))}
              </ul>
              {weighted.hardGatesApplied.length > 0 && (
                <p className="mt-2 text-xs font-semibold text-rose-400">
                  Hard gates: {weighted.hardGatesApplied.join(" · ")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="desk-section-title">
              Current weight profile · {marketRegime}
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th className="py-1 pr-2">Agent</th>
                    <th className="py-1 pr-2">Weight</th>
                    <th className="py-1 pr-2">Hist%</th>
                    <th className="py-1 pr-2">Regime%</th>
                    <th className="py-1">Trusted / down-weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {weighted.weightProfile.entries.map((entry) => (
                    <tr
                      key={entry.agentName}
                      className="border-t border-zinc-800/80 text-zinc-300"
                    >
                      <td className="py-2 pr-2 font-medium">{entry.agentName}</td>
                      <td className="py-2 pr-2 font-mono text-violet-300">
                        {entry.weight}
                      </td>
                      <td className="py-2 pr-2">{entry.historicalAccuracy}%</td>
                      <td className="py-2 pr-2">{entry.regimeAccuracy}%</td>
                      <td className="py-2">
                        {entry.trustedReasons[0] && (
                          <span className="text-emerald-400/90">
                            + {entry.trustedReasons[0]}
                          </span>
                        )}
                        {entry.downweightedReasons[0] && (
                          <span className="ml-2 text-amber-400/90">
                            − {entry.downweightedReasons[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {audit.length > 0 && (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <p className="desk-section-title">Audit log (latest)</p>
              <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
                {audit.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    {new Date(row.timestamp).toLocaleString()} · {row.originalVerdict}{" "}
                    → {row.weightedVerdict}
                    {row.verdictDiffers ? " (diff)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
