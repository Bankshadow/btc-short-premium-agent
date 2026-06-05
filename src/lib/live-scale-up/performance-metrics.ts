import type { DeskIncident } from "@/lib/governance/governance-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { ScalePerformanceSnapshot, StagePerformanceRow } from "./types";
import { getStageDefinition, SCALE_STAGE_ORDER } from "./stage-definitions";
import type { LiveScaleStage } from "./types";

export function computeLivePerformance(
  journal: LiveTradeJournalEntry[],
  incidents: DeskIncident[],
): ScalePerformanceSnapshot {
  const closed = journal.filter(
    (j) => j.status === "CLOSED" && j.realizedPnl != null,
  );
  const wins = closed.filter((j) => (j.realizedPnl ?? 0) > 0);
  const winRatePct =
    closed.length > 0
      ? Number(((wins.length / closed.length) * 100).toFixed(1))
      : 0;

  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  const sorted = [...closed].sort((a, b) =>
    (a.closedAt ?? a.createdAt).localeCompare(b.closedAt ?? b.createdAt),
  );
  for (const t of sorted) {
    equity += t.realizedPnl ?? 0;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDd = Math.max(maxDd, dd);
  }

  const slippageSamples = journal
    .map((j) => j.slippage)
    .filter((s): s is number => s != null && Number.isFinite(s));
  const avgSlippagePct =
    slippageSamples.length > 0
      ? Number(
          (
            slippageSamples.reduce((s, v) => s + v, 0) / slippageSamples.length
          ).toFixed(3),
        )
      : null;

  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  let incidentFreeDays = 365;
  if (openIncidents.length > 0) {
    incidentFreeDays = 0;
  } else {
    const recent = incidents
      .map((i) => Date.parse(i.updatedAt ?? i.createdAt))
      .filter((t) => Number.isFinite(t));
    if (recent.length > 0) {
      const last = Math.max(...recent);
      incidentFreeDays = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
    }
  }

  return {
    closedTrades: closed.length,
    winRatePct,
    maxDrawdownPct: Number(maxDd.toFixed(2)),
    realizedPnlUsd: Number(
      closed.reduce((s, j) => s + (j.realizedPnl ?? 0), 0).toFixed(2),
    ),
    avgSlippagePct,
    incidentFreeDays,
  };
}

export function performanceByStage(
  journal: LiveTradeJournalEntry[],
): StagePerformanceRow[] {
  const rows: StagePerformanceRow[] = [];
  for (const stage of SCALE_STAGE_ORDER) {
    if (stage === "LIVE_STAGE_0_DISABLED") continue;
    const def = getStageDefinition(stage);
    const stageTrades = journal.filter((j) => j.pilotMode === mapStageToPilotMode(stage));
    const closed = stageTrades.filter(
      (j) => j.status === "CLOSED" && j.realizedPnl != null,
    );
    const wins = closed.filter((j) => (j.realizedPnl ?? 0) > 0);
    rows.push({
      stage,
      label: def.label,
      closedTrades: closed.length,
      winRatePct:
        closed.length > 0
          ? Number(((wins.length / closed.length) * 100).toFixed(1))
          : 0,
      realizedPnlUsd: Number(
        closed.reduce((s, j) => s + (j.realizedPnl ?? 0), 0).toFixed(2),
      ),
      avgNotionalUsd:
        closed.length > 0
          ? Number(
              (
                closed.reduce((s, j) => s + (j.entry?.notionalUsd ?? 0), 0) /
                closed.length
              ).toFixed(2),
            )
          : 0,
    });
  }
  return rows;
}

function mapStageToPilotMode(stage: LiveScaleStage): LiveTradeJournalEntry["pilotMode"] {
  if (stage === "LIVE_STAGE_0_DISABLED") return "LIVE_DISABLED";
  return "LIVE_SMALL_PILOT";
}
