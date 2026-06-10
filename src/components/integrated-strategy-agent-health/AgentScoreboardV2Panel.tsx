"use client";

import type {
  AgentScoreboardV2EnrichedRow,
  AgentScoreboardV2EnrichedSegment,
  IntegratedStrategyAgentHealthSnapshot,
} from "@/lib/integrated-strategy-agent-health/types";

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

function AgentRow({ row }: { row: AgentScoreboardV2EnrichedRow }) {
  return (
    <tr className="border-b border-zinc-900/80 text-zinc-300">
      <td className="py-2 pr-3 font-mono text-xs">{row.sourceAgent}</td>
      <td className="py-2 pr-3 font-mono text-xs">{row.sampleCount}</td>
      <td className="py-2 pr-3 font-mono text-xs">{pct(row.predictionAccuracyPct)}</td>
      <td className="py-2 pr-3 font-mono text-xs text-rose-300/90">
        {pct(row.falsePositiveRate)}
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-amber-300/90">
        {pct(row.falseNegativeRate)}
      </td>
      <td className="py-2 pr-3 font-mono text-xs">
        {row.overconfident ? (
          <span className="text-rose-400">yes</span>
        ) : (
          <span className="text-zinc-500">no</span>
        )}
      </td>
      <td className="py-2 pr-3 font-mono text-xs">
        {row.alignedTradeQuality ?? "—"}
      </td>
      <td className="py-2 pr-3 font-mono text-xs">
        {row.vetoQualityPct != null ? `${row.vetoQualityPct}%` : "—"}
      </td>
    </tr>
  );
}

export default function AgentScoreboardV2Panel({
  scoreboard,
  compact = false,
}: {
  scoreboard: AgentScoreboardV2EnrichedSegment | null | undefined;
  compact?: boolean;
}) {
  if (!scoreboard || scoreboard.rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Close testnet trades with decisionLogId and agent outputs to score agent
        contributions.
      </p>
    );
  }

  const rows = compact ? scoreboard.rows.slice(0, 5) : scoreboard.rows;

  return (
    <div className="space-y-3" data-mvp="91">
      <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
        <span>{scoreboard.totalSamples} agent evaluations</span>
        {scoreboard.topContributingAgent && (
          <span className="text-emerald-300/90">
            Top: {scoreboard.topContributingAgent}
          </span>
        )}
        {scoreboard.weakestAgent && (
          <span className="text-rose-300/90">Weakest: {scoreboard.weakestAgent}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-3 font-medium">Agent</th>
              <th className="py-2 pr-3 font-medium">n</th>
              <th className="py-2 pr-3 font-medium">Accuracy</th>
              <th className="py-2 pr-3 font-medium">FPR</th>
              <th className="py-2 pr-3 font-medium">FNR</th>
              <th className="py-2 pr-3 font-medium">Overconf.</th>
              <th className="py-2 pr-3 font-medium">Aligned quality</th>
              <th className="py-2 pr-3 font-medium">Veto quality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AgentRow key={row.sourceAgent} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-zinc-600">
        Advisory only — strategy registry changes require human approval. Risk cannot
        increase automatically.
      </p>
    </div>
  );
}

export function AgentScoreboardV2Summary({
  snapshot,
}: {
  snapshot: IntegratedStrategyAgentHealthSnapshot | null | undefined;
}) {
  if (!snapshot) return null;
  return (
    <AgentScoreboardV2Panel
      scoreboard={snapshot.agentScoreboardV2}
      compact
    />
  );
}
