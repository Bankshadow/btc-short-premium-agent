"use client";

import Link from "next/link";
import { SectionCard } from "@/components/ui";
import type { TerminalBundle } from "@/lib/terminal/terminal-types";
import { TerminalDataTable, TerminalMetric } from "./TerminalDataTable";

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function healthTone(s: string): "ok" | "warn" | "block" {
  if (s === "OK" || s === "ENABLED" || s === "RUNNING") return "ok";
  if (s === "WARNING" || s === "WARN" || s === "PAUSED") return "warn";
  return "block";
}

export function TerminalStatusBar({ bundle }: { bundle: TerminalBundle }) {
  return (
    <div className="terminal-status-bar">
      <div>
        <p className="terminal-status-title">AI Trading Desk Terminal</p>
        <p className="terminal-status-sub">
          MVP 22 · Paper only · Live locked · Built {fmtTime(bundle.meta.builtAt)}
        </p>
      </div>
      <div className="terminal-status-badges">
        <span className="terminal-badge terminal-badge--safe">PAPER ONLY</span>
        <span className="terminal-badge terminal-badge--safe">NO REAL ORDERS</span>
        <span
          className={`terminal-badge ${
            bundle.commandCenter.killSwitchActive ? "terminal-badge--block" : "terminal-badge--safe"
          }`}
        >
          KILL {bundle.commandCenter.killSwitchActive ? "ON" : "OFF"}
        </span>
        <span className="terminal-badge terminal-badge--muted">{bundle.meta.source}</span>
      </div>
    </div>
  );
}

export function CommandCenterPanel({ cc }: { cc: TerminalBundle["commandCenter"] }) {
  return (
    <SectionCard title="1 · Command Center">
      <div className="terminal-metric-strip">
        <TerminalMetric label="BTC regime" value={cc.btcRegime} />
        <TerminalMetric label="ETH regime" value={cc.ethRegime} />
        <TerminalMetric label="Risk mode" value={cc.riskMode} tone={healthTone(cc.riskMode)} />
        <TerminalMetric
          label="System health"
          value={cc.systemHealthStatus}
          tone={healthTone(cc.systemHealthStatus)}
        />
        <TerminalMetric
          label="Paper trading"
          value={cc.paperTradingStatus}
          tone={healthTone(cc.paperTradingStatus)}
        />
        <TerminalMetric
          label="Kill switch"
          value={cc.killSwitchActive ? "ON" : "OFF"}
          sub={cc.killSwitchReason ?? undefined}
          tone={cc.killSwitchActive ? "block" : "ok"}
        />
        <TerminalMetric label="Engine" value={cc.engineState} tone={healthTone(cc.engineState)} />
      </div>
      {cc.activeThesis ? (
        <p className="terminal-thesis">
          <span className="text-[var(--muted)]">Active thesis</span> — {cc.activeThesis}
          {cc.thesisConfidence != null ? ` (${fmtPct(cc.thesisConfidence)} conf.)` : ""}
        </p>
      ) : null}
    </SectionCard>
  );
}

export function MarketDataPanel({ md }: { md: TerminalBundle["marketData"] }) {
  const assets = [
    { label: "BTC", tick: md.btc },
    { label: "ETH", tick: md.eth },
  ];
  return (
    <SectionCard title="2 · Market Data Monitor">
      <TerminalDataTable
        headers={[
          "Asset",
          "Price",
          "Funding",
          "Volatility",
          "Trend",
          "Momentum",
          "Fresh (s)",
          "Quality",
        ]}
        rows={assets.map(({ label, tick }) => [
          label,
          tick.price > 0 ? tick.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—",
          tick.fundingRate != null
            ? `${(tick.fundingRate * 100).toFixed(4)}%${tick.fundingSimulated ? " *" : ""}`
            : "—",
          tick.volatility.toFixed(4),
          tick.trend,
          tick.momentum.toFixed(2),
          Number.isFinite(tick.dataFreshnessSec) ? tick.dataFreshnessSec.toFixed(0) : "—",
          tick.quality,
        ])}
      />
      <p className="terminal-footnote">* Funding rate simulated (paper desk).</p>
    </SectionCard>
  );
}

export function PolymarketMispricingPanel({ rows }: { rows: TerminalBundle["polymarketMispricing"] }) {
  return (
    <SectionCard title="3 · Polymarket Mispricing Monitor">
      <TerminalDataTable
        headers={["Market", "Fair", "Poly", "Edge", "Conf", "Liq", "Spread", "Status"]}
        rows={rows.slice(0, 20).map((r) => [
          r.marketLabel,
          r.fairProbability.toFixed(2),
          r.polymarketPrice.toFixed(2),
          fmtPct(r.edge),
          fmtPct(r.confidence),
          r.liquidity.toLocaleString(),
          r.spread.toFixed(3),
          r.status,
        ])}
        emptyMessage="No Polymarket markets — run scan from Polymarket page."
      />
    </SectionCard>
  );
}

export function SweeperScannerPanel({ rows }: { rows: TerminalBundle["sweeperScanner"] }) {
  return (
    <SectionCard title="4 · Sweeper Scanner">
      <TerminalDataTable
        headers={[
          "Type",
          "Market",
          "YES",
          "NO",
          "Cost",
          "Gross",
          "Net",
          "Flags",
          "Signal",
          "Paper",
          "At",
        ]}
        rows={rows.slice(0, 20).map((r) => [
          r.opportunityType.replace(/_/g, " "),
          r.marketId,
          r.yesAsk?.toFixed(3) ?? "—",
          r.noAsk?.toFixed(3) ?? "—",
          r.totalCost?.toFixed(3) ?? "—",
          fmtPct(r.grossEdge),
          r.netEdge != null ? fmtPct(r.netEdge) : "—",
          r.riskFlags.join(", ") || "—",
          r.signalStatus,
          r.paperTradeStatus,
          fmtTime(r.createdAt),
        ])}
        emptyMessage="No sweeper opportunities — run sweeper scan."
      />
    </SectionCard>
  );
}

export function AgentDebatePanel({ debate }: { debate: TerminalBundle["agentDebate"] }) {
  const columns = [
    { title: "Bull thesis", text: debate.bullThesis },
    { title: "Bear thesis", text: debate.bearThesis },
    { title: "Quant view", text: debate.quantView },
    { title: "Risk manager", text: debate.riskManagerView },
    { title: "Committee", text: debate.committeeView },
  ];
  return (
    <SectionCard title="5 · Agent Debate Console">
      <p className="terminal-footnote mb-3">Advisory only — cannot execute or override risk gate.</p>
      <div className="terminal-debate-grid">
        {columns.map((c) => (
          <div key={c.title} className="terminal-debate-col">
            <h4 className="terminal-debate-heading">{c.title}</h4>
            <p className="terminal-debate-body">{c.text ?? "—"}</p>
          </div>
        ))}
      </div>
      {debate.finalRecommendation ? (
        <p className="mt-3 text-sm">
          <span className="text-[var(--muted)]">Final recommendation:</span>{" "}
          <strong>{debate.finalRecommendation}</strong>
        </p>
      ) : null}
      {debate.unresolvedDisagreements.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-xs text-[var(--muted)]">
          {debate.unresolvedDisagreements.map((d) => (
            <li key={d.slice(0, 40)}>{d}</li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}

export function RiskGuardPanel({ rows }: { rows: TerminalBundle["riskGuard"] }) {
  return (
    <SectionCard title="6 · Risk Guard Console">
      <TerminalDataTable
        headers={["Time", "Source", "Signal", "Rules", "Severity", "Reason", "Action"]}
        rows={rows.slice(0, 25).map((r) => [
          fmtTime(r.createdAt),
          r.source,
          r.blockedSignal,
          r.triggeredRules.join(", "),
          r.severity,
          r.reason,
          r.recommendedAction,
        ])}
        emptyMessage="No blocked signals in recent window."
      />
    </SectionCard>
  );
}

export function PaperBlotterPanel({ rows }: { rows: TerminalBundle["paperBlotter"] }) {
  return (
    <SectionCard title="7 · Paper Execution Blotter">
      <TerminalDataTable
        headers={[
          "Time",
          "Source",
          "Market",
          "Side",
          "Entry",
          "Current",
          "Size",
          "Unrealized",
          "Realized",
          "Status",
        ]}
        rows={rows.slice(0, 30).map((r) => [
          fmtTime(r.createdAt),
          r.source,
          r.symbolOrMarket,
          r.side,
          r.entryPrice.toFixed(4),
          r.currentPrice?.toFixed(4) ?? "—",
          r.size.toFixed(2),
          r.unrealizedPnl.toFixed(4),
          r.realizedPnl.toFixed(4),
          r.status,
        ])}
        emptyMessage="No paper trades yet."
      />
    </SectionCard>
  );
}

export function DecisionJournalPanel({ rows }: { rows: TerminalBundle["decisionJournal"] }) {
  return (
    <SectionCard title="8 · Decision Journal">
      <TerminalDataTable
        headers={["Time", "Decision ID", "Source", "Thesis", "Risk notes", "Outcome", "Reflection"]}
        rows={rows.slice(0, 25).map((r) => [
          fmtTime(r.timestamp),
          r.decisionId,
          r.signalSource,
          r.thesis.slice(0, 80),
          r.riskNotes.slice(0, 60) || "—",
          r.outcome ?? "—",
          r.reflection?.slice(0, 60) ?? "—",
        ])}
        emptyMessage="No decision journal entries yet."
      />
    </SectionCard>
  );
}

export function SystemHealthPanel({ health }: { health: TerminalBundle["systemHealth"] }) {
  return (
    <SectionCard title="9 · System Health">
      <div className="terminal-metric-strip">
        <TerminalMetric
          label="Market data"
          value={health.marketDataFresh ? "FRESH" : "STALE"}
          tone={health.marketDataFresh ? "ok" : "block"}
        />
        <TerminalMetric
          label="Polymarket data"
          value={health.polymarketDataFresh ? "FRESH" : "STALE"}
          tone={health.polymarketDataFresh ? "ok" : "warn"}
        />
        <TerminalMetric
          label="Fair price engine"
          value={health.fairPriceEngineOk ? "OK" : "DOWN"}
          tone={health.fairPriceEngineOk ? "ok" : "block"}
        />
        <TerminalMetric
          label="Risk engine"
          value={health.riskEngineOk ? "OK" : "BLOCKED"}
          tone={health.riskEngineOk ? "ok" : "block"}
        />
        <TerminalMetric
          label="Paper simulator"
          value={health.paperSimulatorOk ? "OK" : "OFF"}
          tone={health.paperSimulatorOk ? "ok" : "warn"}
        />
        <TerminalMetric label="Error count" value={String(health.errorCount)} tone={health.errorCount > 0 ? "warn" : "ok"} />
      </div>
      {health.messages.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-xs text-[var(--muted)]">
          {health.messages.map((m) => (
            <li key={m.slice(0, 48)}>{m}</li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}

export function ConfigKillSwitchPanel({ config }: { config: TerminalBundle["configPanel"] }) {
  return (
    <SectionCard title="10 · Config / Kill Switch Panel">
      <p className="terminal-footnote mb-3">
        Read-only thresholds. Change kill switch on{" "}
        <Link href="/operator" className="text-[var(--accent)] underline">
          Operator
        </Link>{" "}
        · Polymarket scans on{" "}
        <Link href="/polymarket" className="text-[var(--accent)] underline">
          Polymarket
        </Link>
        .
      </p>
      <div className="terminal-config-grid">
        <TerminalMetric label="Min edge" value={fmtPct(config.minEdge)} />
        <TerminalMetric label="Min confidence" value={fmtPct(config.minConfidence)} />
        <TerminalMetric label="Max spread" value={fmtPct(config.maxSpread)} />
        <TerminalMetric label="Min liquidity" value={String(config.minLiquidity)} />
        <TerminalMetric label="Max exposure / mkt" value={`$${config.maxExposurePerMarket}`} />
        <TerminalMetric label="Max exposure total" value={`$${config.maxExposureTotal}`} />
        <TerminalMetric
          label="Paper trading"
          value={config.paperTradingEnabled ? "ENABLED" : "DISABLED"}
          tone={config.paperTradingEnabled ? "ok" : "warn"}
        />
        <TerminalMetric label="Real trading" value="LOCKED OFF" tone="ok" />
        <TerminalMetric
          label="Kill switch"
          value={config.killSwitchEnabled ? "ENABLED" : "OFF"}
          tone={config.killSwitchEnabled ? "block" : "ok"}
        />
      </div>
    </SectionCard>
  );
}
