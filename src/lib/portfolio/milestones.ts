import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { summarizePaperPortfolio } from "@/lib/paper/paper-orders";
import type { DeskPortfolioSnapshot, PortfolioMilestone } from "./portfolio-types";

function milestone(
  id: string,
  title: string,
  description: string,
  status: PortfolioMilestone["status"],
  progressPct: number,
  achievedAt: string | null = null,
): PortfolioMilestone {
  return { id, title, description, status, progressPct, achievedAt };
}

export function computePortfolioMilestones(
  logs: DecisionLogEntry[],
  orders: PaperOrder[],
): PortfolioMilestone[] {
  const resolved = logs.filter((e) => e.outcomeStatus === "RESOLVED");
  const paper = summarizePaperPortfolio(orders);
  const netLogPnl = resolved.reduce((s, e) => s + (e.paperPnl ?? 0), 0);
  const wins = resolved.filter((e) => (e.paperPnl ?? 0) > 0).length;

  let streakWins = 0;
  for (const e of resolved) {
    if ((e.paperPnl ?? 0) > 0) streakWins += 1;
    else break;
  }

  const items: PortfolioMilestone[] = [];

  items.push(
    logs.length >= 1
      ? milestone(
          "first-session",
          "First desk session",
          "Logged first committee run.",
          "achieved",
          100,
          logs[0]?.timestamp ?? null,
        )
      : milestone(
          "first-session",
          "First desk session",
          "Run analyze to log your first session.",
          "locked",
          0,
        ),
  );

  items.push(
    paper.closedCount >= 1 || orders.some((o) => o.status === "OPEN")
      ? milestone(
          "first-paper",
          "Paper book opened",
          "AI-linked paper trade recorded.",
          "achieved",
          100,
          orders[0]?.openedAt ?? null,
        )
      : milestone(
          "first-paper",
          "Paper book opened",
          "Wait for committee TRADE to open paper.",
          "in_progress",
          paper.openCount > 0 ? 80 : 0,
        ),
  );

  const resolveTarget = 5;
  const resolveProgress = Math.min(100, (resolved.length / resolveTarget) * 100);
  items.push(
    resolved.length >= resolveTarget
      ? milestone(
          "resolve-5",
          "5 resolved outcomes",
          "Enough history for scoreboard learning.",
          "achieved",
          100,
          resolved[resolveTarget - 1]?.resolution?.resolvedAt ?? null,
        )
      : milestone(
          "resolve-5",
          "5 resolved outcomes",
          `${resolved.length}/${resolveTarget} resolved — close paper or resolve log.`,
          resolved.length > 0 ? "in_progress" : "locked",
          resolveProgress,
        ),
  );

  items.push(
    netLogPnl >= 2
      ? milestone(
          "net-pnl-2",
          "Net paper +2%",
          "Cumulative resolved log PnL crossed +2%.",
          "achieved",
          100,
          null,
        )
      : milestone(
          "net-pnl-2",
          "Net paper +2%",
          `Current net ${netLogPnl >= 0 ? "+" : ""}${netLogPnl.toFixed(2)}% from resolved logs.`,
          netLogPnl > 0 ? "in_progress" : "locked",
          Math.min(100, Math.max(0, (netLogPnl / 2) * 100)),
        ),
  );

  items.push(
    streakWins >= 3
      ? milestone(
          "win-streak-3",
          "3-win streak",
          "Three consecutive positive resolved runs.",
          "achieved",
          100,
          null,
        )
      : milestone(
          "win-streak-3",
          "3-win streak",
          `Current streak: ${streakWins} win(s).`,
          streakWins > 0 ? "in_progress" : "locked",
          Math.min(100, (streakWins / 3) * 100),
        ),
  );

  items.push(
    paper.totalRealizedPnlPct >= 3
      ? milestone(
          "paper-book-3",
          "Paper book +3%",
          "Closed paper orders net +3% or more.",
          "achieved",
          100,
          null,
        )
      : milestone(
          "paper-book-3",
          "Paper book +3%",
          `Closed paper PnL: ${paper.totalRealizedPnlPct >= 0 ? "+" : ""}${paper.totalRealizedPnlPct}%.`,
          paper.closedCount > 0 ? "in_progress" : "locked",
          Math.min(100, Math.max(0, (paper.totalRealizedPnlPct / 3) * 100)),
        ),
  );

  return items;
}

export function buildDeskPortfolioSnapshot(
  logs: DecisionLogEntry[],
  orders: PaperOrder[],
): DeskPortfolioSnapshot {
  const resolved = logs.filter((e) => e.outcomeStatus === "RESOLVED");
  const netLogPaperPnlPct = Number(
    resolved.reduce((s, e) => s + (e.paperPnl ?? 0), 0).toFixed(2),
  );

  let streakWins = 0;
  let streakLosses = 0;
  for (const e of resolved) {
    if ((e.paperPnl ?? 0) > 0) {
      streakWins += 1;
      streakLosses = 0;
    } else if ((e.paperPnl ?? 0) < 0) {
      streakLosses += 1;
      streakWins = 0;
    } else break;
  }

  return {
    generatedAt: new Date().toISOString(),
    paper: summarizePaperPortfolio(orders),
    resolvedLogCount: resolved.length,
    netLogPaperPnlPct,
    milestones: computePortfolioMilestones(logs, orders),
    streakWins,
    streakLosses,
  };
}
