import type { LivePilotRiskConfig, LiveTradeJournalEntry, PilotDailyMetrics } from "./types";

function startOfDayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekMs(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function tradeTimestamp(entry: LiveTradeJournalEntry): number {
  const ts = entry.executedAt ?? entry.createdAt;
  return Date.parse(ts);
}

export function computePilotDailyMetrics(
  journal: LiveTradeJournalEntry[],
  config: LivePilotRiskConfig,
): PilotDailyMetrics {
  const dayStart = startOfDayMs();
  const weekStart = startOfWeekMs();
  const now = Date.now();

  const executed = journal.filter(
    (j) =>
      j.status === "EXECUTED" ||
      j.status === "OPEN" ||
      j.status === "CLOSED",
  );

  const todayTrades = executed.filter((j) => tradeTimestamp(j) >= dayStart);
  const weekTrades = executed.filter((j) => tradeTimestamp(j) >= weekStart);

  const closedToday = journal.filter(
    (j) =>
      j.status === "CLOSED" &&
      j.closedAt &&
      Date.parse(j.closedAt) >= dayStart,
  );
  const closedWeek = journal.filter(
    (j) =>
      j.status === "CLOSED" &&
      j.closedAt &&
      Date.parse(j.closedAt) >= weekStart,
  );

  const realizedPnlTodayUsd = closedToday.reduce(
    (s, j) => s + (j.realizedPnl ?? 0),
    0,
  );
  const realizedPnlWeekUsd = closedWeek.reduce(
    (s, j) => s + (j.realizedPnl ?? 0),
    0,
  );

  const losses = journal
    .filter((j) => j.status === "CLOSED" && (j.realizedPnl ?? 0) < 0)
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));

  const lastLossAt = losses[0]?.closedAt ?? null;
  let inCooldown = false;
  let cooldownUntil: string | null = null;

  if (lastLossAt) {
    const until = Date.parse(lastLossAt) + config.cooldownMinutesAfterLoss * 60_000;
    if (until > now) {
      inCooldown = true;
      cooldownUntil = new Date(until).toISOString();
    }
  }

  const dailyLossUsedPct =
    config.dailyLossLimitUsd > 0
      ? Math.min(
          100,
          Math.round(
            (Math.abs(Math.min(0, realizedPnlTodayUsd)) /
              config.dailyLossLimitUsd) *
              100,
          ),
        )
      : 0;

  return {
    tradesToday: todayTrades.length,
    realizedPnlTodayUsd: Number(realizedPnlTodayUsd.toFixed(2)),
    realizedPnlWeekUsd: Number(realizedPnlWeekUsd.toFixed(2)),
    lastLossAt,
    inCooldown,
    cooldownUntil,
    dailyLossLimitUsd: config.dailyLossLimitUsd,
    dailyTradeLimit: config.dailyTradeLimit,
    weeklyLossLimitUsd: config.weeklyLossLimitUsd,
    dailyLossUsedPct,
  };
}
