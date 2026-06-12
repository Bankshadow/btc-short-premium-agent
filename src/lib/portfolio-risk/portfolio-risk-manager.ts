import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { DEFAULT_START_CAPITAL } from "@/lib/mission/mission-types";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { getReconciliationStatus } from "@/lib/positions/position-monitor";
import { maxPreviewNotionalUsd } from "@/lib/risk/risk-gate";
import { getTradesSummary } from "@/lib/trades/trade-query";
import { sumDailyPnl } from "@/lib/pnl/daily-pnl";
import { buildEvidenceProgressFromEvents } from "@/lib/evidence/evidence-progress-engine";
import { EVIDENCE_REQUIRED_TRADES } from "@/lib/evidence/evidence-types";
import type { PortfolioRiskIssue, PortfolioRiskReport } from "./portfolio-risk-types";

const DAILY_LOSS_LIMIT = 25;
const MAX_DRAWDOWN_PCT = 15;
const MAX_OPEN_POSITIONS = 1;
const MAX_CONSECUTIVE_LOSSES = 3;
const COOLDOWN_MS = 30 * 60 * 1000;

let cooldownUntil: string | null = null;

function loadCooldownUntil(events: Awaited<ReturnType<typeof getEvents>>): string | null {
  const latest = [...events]
    .filter((e) => e.type === "COOLDOWN_STARTED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!latest) return null;
  const until = String((latest.payload as { until?: string }).until ?? "");
  if (until && Date.parse(until) > Date.now()) return until;
  return null;
}

function countConsecutiveLosses(events: Awaited<ReturnType<typeof getEvents>>): number {
  const pnls = events
    .filter((e) => e.type === "PNL_REALIZED")
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  let streak = 0;
  for (const e of pnls) {
    if ((e.payload as { result?: string }).result === "LOSS") streak += 1;
    else break;
  }
  return streak;
}

function symbolConcentration(trades: Awaited<ReturnType<typeof getTradesSummary>>): PortfolioRiskIssue | null {
  if (trades.open.length === 0) return null;
  const symbols = new Set(trades.open.map((t) => t.symbol));
  if (symbols.size === 1 && trades.open.length >= 1) {
    return {
      code: "SYMBOL_CONCENTRATION",
      message: `All exposure in ${[...symbols][0]}.`,
      severity: "WARNING",
    };
  }
  return null;
}

export async function buildPortfolioRiskView(): Promise<PortfolioRiskReport> {
  const events = await getEvents();
  const mission = buildMissionSnapshot(events);
  const trades = await getTradesSummary();
  const reconciliation = await getReconciliationStatus();
  const issues: PortfolioRiskIssue[] = [];

  cooldownUntil = loadCooldownUntil(events);
  const dailyPnl = sumDailyPnl(events);
  const drawdownPct =
    mission.currentEquity < DEFAULT_START_CAPITAL
      ? ((DEFAULT_START_CAPITAL - mission.currentEquity) / DEFAULT_START_CAPITAL) * 100
      : 0;
  const openExposureUsd = trades.open.reduce((s, t) => s + t.notionalUsd, 0);
  const consecutiveLosses = countConsecutiveLosses(events);
  const evidenceCollectionActive =
    buildEvidenceProgressFromEvents(events).validTrades < EVIDENCE_REQUIRED_TRADES;

  if (dailyPnl <= -DAILY_LOSS_LIMIT) {
    issues.push({ code: "DAILY_LOSS_LIMIT", message: `Daily loss $${dailyPnl.toFixed(2)} exceeds limit.`, severity: "BLOCK" });
  }
  if (drawdownPct >= MAX_DRAWDOWN_PCT) {
    issues.push({ code: "MAX_DRAWDOWN", message: `Drawdown ${drawdownPct.toFixed(1)}% exceeds ${MAX_DRAWDOWN_PCT}%.`, severity: "BLOCK" });
  }
  if (openExposureUsd > maxPreviewNotionalUsd() * MAX_OPEN_POSITIONS) {
    issues.push({ code: "MAX_EXPOSURE", message: `Exposure $${openExposureUsd} exceeds portfolio cap.`, severity: "BLOCK" });
  }
  if (trades.open.length > MAX_OPEN_POSITIONS) {
    issues.push({ code: "MAX_OPEN_POSITIONS", message: `${trades.open.length} open positions exceeds limit.`, severity: "BLOCK" });
  }
  if (consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
    issues.push({
      code: "CONSECUTIVE_LOSSES",
      message: `${consecutiveLosses} consecutive losses.`,
      severity: evidenceCollectionActive ? "WARNING" : "BLOCK",
    });
  }
  if (cooldownUntil && Date.parse(cooldownUntil) > Date.now()) {
    issues.push({ code: "COOLDOWN_ACTIVE", message: `Cooldown active until ${cooldownUntil}.`, severity: "BLOCK" });
  }
  const concentration = symbolConcentration(trades);
  if (concentration) issues.push(concentration);
  if (reconciliation.status === "BLOCKED" && trades.open.length > 0) {
    issues.push({ code: "STALE_RECONCILIATION", message: "Reconciliation BLOCKED with open positions.", severity: "BLOCK" });
  }

  const blockers = issues.filter((i) => i.severity === "BLOCK");
  const blocksExecution = blockers.length > 0;
  const status = blocksExecution ? "BLOCKED" : issues.length > 0 ? "WARNING" : "OK";

  return {
    status,
    evaluatedAt: new Date().toISOString(),
    issues,
    blocksExecution,
    dailyPnl,
    drawdownPct: Number(drawdownPct.toFixed(2)),
    openExposureUsd,
    openPositions: trades.open.length,
    consecutiveLosses,
    cooldownUntil,
    message: blocksExecution ? "Portfolio risk blocks new execution." : "Portfolio risk OK.",
    liveLocked: true,
  };
}

export async function evaluatePortfolioRisk(): Promise<PortfolioRiskReport> {
  const report = await buildPortfolioRiskView();

  await appendEvent({
    type: "PORTFOLIO_RISK_EVALUATED",
    environment: "testnet",
    payload: {
      status: report.status,
      issueCount: report.issues.length,
      blocksExecution: report.blocksExecution,
    },
  });

  if (report.blocksExecution) {
    await appendEvent({
      type: "PORTFOLIO_RISK_BLOCKED",
      environment: "testnet",
      payload: {
        codes: report.issues.filter((i) => i.severity === "BLOCK").map((b) => b.code),
      },
    });
  }

  const blockers = report.issues.filter((i) => i.severity === "BLOCK");
  if (blockers.some((b) => b.code === "DAILY_LOSS_LIMIT")) {
    await appendEvent({
      type: "DAILY_LOSS_LIMIT_TRIGGERED",
      environment: "testnet",
      payload: { dailyPnl: report.dailyPnl, limit: DAILY_LOSS_LIMIT },
    });
  }
  if (
    blockers.some((b) => b.code === "CONSECUTIVE_LOSSES") &&
    !cooldownUntil &&
    buildEvidenceProgressFromEvents(await getEvents()).validTrades >= EVIDENCE_REQUIRED_TRADES
  ) {
    cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
    await appendEvent({
      type: "COOLDOWN_STARTED",
      environment: "testnet",
      payload: { until: cooldownUntil, reason: "CONSECUTIVE_LOSSES" },
    });
  } else {
    cooldownUntil = loadCooldownUntil(await getEvents());
  }

  return report;
}

export async function getLatestPortfolioRisk(): Promise<PortfolioRiskReport> {
  return buildPortfolioRiskView();
}

export async function isPortfolioRiskBlocking(): Promise<boolean> {
  const report = await buildPortfolioRiskView();
  return report.blocksExecution;
}
