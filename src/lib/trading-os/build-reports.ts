import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { loadIncidents } from "@/lib/governance/incidents-store";
import type { DeskProfile } from "./trading-os-types";
import type { DeskReport, ReportKind, EnvironmentMode } from "./trading-os-types";

function dayStartMs(daysAgo = 0): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - daysAgo * 24 * 60 * 60 * 1000;
}

function filterEntriesByWindow(
  entries: DecisionLogEntry[],
  sinceMs: number,
): DecisionLogEntry[] {
  return entries.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
}

export function buildDailyDeskReport(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  profile: DeskProfile;
  mode: EnvironmentMode;
}): DeskReport {
  const today = filterEntriesByWindow(input.entries, dayStartMs(0));
  const trades = today.filter((e) => e.finalVerdict === "TRADE").length;
  const skips = today.filter((e) => e.finalVerdict === "SKIP").length;
  const vetoes = today.filter((e) => e.riskVeto).length;
  const portfolio = buildDeskPortfolioSnapshot(input.entries, input.orders);

  const md = `# Daily Desk Report
Generated: ${new Date().toISOString()}
Profile: ${input.profile.name}
Mode: ${input.mode}

## Sessions today
- Runs logged: ${today.length}
- TRADE verdicts: ${trades}
- SKIP: ${skips}
- Risk vetoes: ${vetoes}

## Paper book
- Open: ${portfolio.paper.openCount}
- Closed: ${portfolio.paper.closedCount}
- Realized PnL %: ${portfolio.paper.totalRealizedPnlPct}
- Net log PnL %: ${portfolio.netLogPaperPnlPct}

## Note
Analysis only — no live exchange execution.
`;

  return {
    kind: "daily_desk",
    title: `Daily desk · ${new Date().toLocaleDateString()}`,
    generatedAt: new Date().toISOString(),
    format: "markdown",
    content: md,
  };
}

export function buildWeeklyPerformanceReport(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  profile: DeskProfile;
}): DeskReport {
  const week = filterEntriesByWindow(input.entries, dayStartMs(7));
  const resolved = week.filter((e) => e.outcomeStatus === "RESOLVED");
  const wins = resolved.filter((e) => (e.paperPnl ?? 0) > 0).length;
  const net = resolved.reduce((s, e) => s + (e.paperPnl ?? 0), 0);
  const portfolio = buildDeskPortfolioSnapshot(input.entries, input.orders);

  const md = `# Weekly Performance Report
Generated: ${new Date().toISOString()}
Profile: ${input.profile.name}

## Last 7 days
- Sessions: ${week.length}
- Resolved: ${resolved.length}
- Win rate: ${resolved.length ? Math.round((wins / resolved.length) * 100) : 0}%
- Net resolved log PnL %: ${net.toFixed(2)}

## Cumulative paper
- Total realized %: ${portfolio.paper.totalRealizedPnlPct}
- Streak wins: ${portfolio.streakWins}
`;

  return {
    kind: "weekly_performance",
    title: "Weekly performance",
    generatedAt: new Date().toISOString(),
    format: "markdown",
    content: md,
  };
}

export function buildAgentScoreboardReport(
  entries: DecisionLogEntry[],
): DeskReport {
  const board = buildAgentScoreboard(entries);
  const lines = board.agents.map(
    (a) =>
      `- ${a.agentName}: calls ${a.totalCalls}, correct trades ${a.correctTradeCalls}, FP ${a.falsePositives}, FN ${a.falseNegatives}`,
  );

  const md = `# Agent Scoreboard Export
Generated: ${new Date().toISOString()}
Resolved: ${board.totalResolved} · Pending: ${board.totalPending}
Net paper PnL %: ${board.netPaperPnlPct}
Risk veto accuracy: ${board.riskVetoAccuracyPct}%

## Agents
${lines.join("\n")}
`;

  return {
    kind: "agent_scoreboard",
    title: "Agent scoreboard",
    generatedAt: new Date().toISOString(),
    format: "markdown",
    content: md,
  };
}

export function buildRiskIncidentReport(): DeskReport {
  const incidents = loadIncidents();
  const open = incidents.filter((i) => i.status === "open" || i.status === "investigating");

  const md = `# Risk & Incident Report
Generated: ${new Date().toISOString()}
Total incidents: ${incidents.length}
Open / investigating: ${open.length}

${incidents
  .map(
    (i) => `## ${i.id}
- Type: ${i.type} · Severity: ${i.severity} · Status: ${i.status}
- ${i.description}
- Root cause: ${i.rootCause || "—"}
- Corrective: ${i.correctiveAction || "—"}
- Decision: ${i.affectedDecisionId ?? "—"}
`,
  )
  .join("\n")}
`;

  return {
    kind: "risk_incidents",
    title: "Risk incident report",
    generatedAt: new Date().toISOString(),
    format: "markdown",
    content: md,
  };
}

export function buildReport(
  kind: ReportKind,
  input: {
    entries: DecisionLogEntry[];
    orders: PaperOrder[];
    profile: DeskProfile;
    mode: EnvironmentMode;
  },
): DeskReport {
  switch (kind) {
    case "daily_desk":
      return buildDailyDeskReport(input);
    case "weekly_performance":
      return buildWeeklyPerformanceReport(input);
    case "agent_scoreboard":
      return buildAgentScoreboardReport(input.entries);
    case "risk_incidents":
      return buildRiskIncidentReport();
  }
}

export function buildPublicPerformanceSummary(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  profileName: string;
}): {
  generatedAt: string;
  profileName: string;
  totalSessions: number;
  resolvedCount: number;
  tradeSignals: number;
  netPaperPnlPct: number;
  openPaperCount: number;
  disclaimer: string;
} {
  const portfolio = buildDeskPortfolioSnapshot(input.entries, input.orders);
  const tradeSignals = input.entries.filter((e) => e.finalVerdict === "TRADE").length;

  return {
    generatedAt: new Date().toISOString(),
    profileName: input.profileName,
    totalSessions: input.entries.length,
    resolvedCount: portfolio.resolvedLogCount,
    tradeSignals,
    netPaperPnlPct: portfolio.netLogPaperPnlPct,
    openPaperCount: portfolio.paper.openCount,
    disclaimer:
      "Public summary — no operator overrides, tickets, or incident detail. Hypothetical paper only.",
  };
}
