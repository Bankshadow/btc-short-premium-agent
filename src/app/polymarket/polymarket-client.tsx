"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/api/fetch-json";
import { Badge, StatCard } from "@/components/use-api";
import { PageHeader, SectionCard } from "@/components/ui";
import type {
  BlockedSignalRecord,
  FairProbabilityResult,
  MispricingSignal,
  PaperTradeRecord,
  PolymarketHealthReport,
  PolymarketMarket,
  RiskEventRecord,
} from "@/lib/polymarket/types";
import type {
  BlockedSweeperRecord,
  SweeperOpportunity,
  SweeperPaperTrade,
} from "@/lib/polymarket/sweeper-types";

interface PolymarketStatusResponse {
  ok: boolean;
  markets: PolymarketMarket[];
  fairPrices: FairProbabilityResult[];
  signals: MispricingSignal[];
  blockedSignals: BlockedSignalRecord[];
  paperTrades: PaperTradeRecord[];
  riskEvents: RiskEventRecord[];
  health: PolymarketHealthReport;
  commentary: string[];
  sweeperOpportunities: SweeperOpportunity[];
  blockedSweeperOpportunities: BlockedSweeperRecord[];
  sweeperPaperTrades: SweeperPaperTrade[];
  config: { paperTradingEnabled: boolean; realTradingEnabled: false; killSwitchActive: boolean };
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function PolymarketClient() {
  const [data, setData] = useState<PolymarketStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sweeperRunning, setSweeperRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<PolymarketStatusResponse>("/api/polymarket/status");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCycle() {
    setRunning(true);
    setError(null);
    try {
      await fetchJson("/api/polymarket/run", { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cycle failed");
    } finally {
      setRunning(false);
    }
  }

  async function runSweeperScan() {
    setSweeperRunning(true);
    setError(null);
    try {
      await fetchJson("/api/polymarket/sweeper/run", { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sweeper scan failed");
    } finally {
      setSweeperRunning(false);
    }
  }

  const fairByMarket = new Map(data?.fairPrices.map((f) => [f.marketId, f]) ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polymarket Mispricing"
        description="MVP 21 · Paper simulation only · Live locked · No real-money execution"
      />

      <div className="flex flex-wrap gap-3">
        <StatCard label="Health" value={data?.health.status ?? "—"} />
        <StatCard label="Markets" value={String(data?.markets.length ?? 0)} />
        <StatCard label="Signals" value={String(data?.signals.length ?? 0)} />
        <StatCard label="Paper trades" value={String(data?.paperTrades.length ?? 0)} />
        <StatCard
          label="Sweeper opps"
          value={String(data?.sweeperOpportunities.length ?? 0)}
        />
        <StatCard
          label="Sweeper blocked"
          value={String(data?.blockedSweeperOpportunities.length ?? 0)}
        />
        <StatCard
          label="Kill switch"
          value={data?.config.killSwitchActive ? "ON" : "OFF"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runCycle()}
          disabled={running}
          className="rounded-md bg-[var(--ring-pop)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? "Running cycle…" : "Run scan cycle"}
        </button>
        <button
          type="button"
          onClick={() => void runSweeperScan()}
          disabled={sweeperRunning}
          className="rounded-md border border-[var(--ring-pop)] px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {sweeperRunning ? "Scanning order books…" : "Run sweeper scan"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-[var(--ring-pop)] px-4 py-2 text-sm"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading && !data && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {data?.commentary.length ? (
        <SectionCard title="AI commentary (rule-based)">
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            {data.commentary.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="A · Active crypto Polymarket markets">
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Asset</th>
              <th className="py-2 pr-3">End</th>
              <th className="py-2 pr-3">Yes</th>
              <th className="py-2 pr-3">No</th>
              <th className="py-2 pr-3">Bid/Ask</th>
              <th className="py-2 pr-3">Liq</th>
              <th className="py-2 pr-3">Vol</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.markets ?? []).map((m) => (
              <tr key={m.marketId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 max-w-xs truncate" title={m.question}>{m.question}</td>
                <td className="py-2 pr-3">{m.asset}</td>
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(m.endTime)}</td>
                <td className="py-2 pr-3">{m.yesPrice.toFixed(2)}</td>
                <td className="py-2 pr-3">{m.noPrice.toFixed(2)}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {m.bestBidYes.toFixed(2)}/{m.bestAskYes.toFixed(2)}
                </td>
                <td className="py-2 pr-3">{m.liquidity.toLocaleString()}</td>
                <td className="py-2 pr-3">{m.volume.toLocaleString()}</td>
                <td className="py-2 pr-3"><Badge tone="safe">{m.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </SectionCard>

      <SectionCard title="B · Fair price monitor">
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Poly YES</th>
              <th className="py-2 pr-3">Fair YES</th>
              <th className="py-2 pr-3">Diff</th>
              <th className="py-2 pr-3">Confidence</th>
              <th className="py-2 pr-3">Model</th>
            </tr>
          </thead>
          <tbody>
            {(data?.markets ?? []).map((m) => {
              const fair = fairByMarket.get(m.marketId);
              const diff = fair ? fair.fairProbabilityYes - m.yesPrice : 0;
              return (
                <tr key={m.marketId} className="border-b border-[var(--ring-pop)]/10">
                  <td className="py-2 pr-3 max-w-xs truncate">{m.slug}</td>
                  <td className="py-2 pr-3">{m.yesPrice.toFixed(2)}</td>
                  <td className="py-2 pr-3">{fair?.fairProbabilityYes.toFixed(2) ?? "—"}</td>
                  <td className="py-2 pr-3">{fair ? fmtPct(diff) : "—"}</td>
                  <td className="py-2 pr-3">{fair ? fmtPct(fair.confidenceScore) : "—"}</td>
                  <td className="py-2 pr-3 text-xs text-[var(--muted)]">{fair?.modelReason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </SectionCard>

      <SectionCard title="C · Mispricing signals">
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Side</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Fair</th>
              <th className="py-2 pr-3">Edge</th>
              <th className="py-2 pr-3">Conf</th>
              <th className="py-2 pr-3">Flags</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.signals ?? []).slice(0, 30).map((s) => (
              <tr key={s.signalId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(s.createdAt)}</td>
                <td className="py-2 pr-3">{s.marketId}</td>
                <td className="py-2 pr-3">{s.side}</td>
                <td className="py-2 pr-3">{s.suggestedPrice.toFixed(2)}</td>
                <td className="py-2 pr-3">{s.fairPrice.toFixed(2)}</td>
                <td className="py-2 pr-3">{fmtPct(s.estimatedEdge)}</td>
                <td className="py-2 pr-3">{fmtPct(s.confidence)}</td>
                <td className="py-2 pr-3 text-xs">{s.riskFlags.join(", ") || "—"}</td>
                <td className="py-2 pr-3">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </SectionCard>

      <SectionCard title="D · Paper trades (simulated)">
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Side</th>
              <th className="py-2 pr-3">Entry</th>
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Current</th>
              <th className="py-2 pr-3">Unrealized</th>
              <th className="py-2 pr-3">Realized</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.paperTrades ?? []).map((t) => (
              <tr key={t.tradeId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(t.createdAt)}</td>
                <td className="py-2 pr-3">{t.marketId}</td>
                <td className="py-2 pr-3">{t.side}</td>
                <td className="py-2 pr-3">{t.simulatedEntryPrice.toFixed(2)}</td>
                <td className="py-2 pr-3">{t.simulatedSize.toFixed(2)}</td>
                <td className="py-2 pr-3">{t.currentPrice?.toFixed(2) ?? "—"}</td>
                <td className="py-2 pr-3">{t.unrealizedPnl.toFixed(4)}</td>
                <td className="py-2 pr-3">{t.realizedPnl.toFixed(4)}</td>
                <td className="py-2 pr-3">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </SectionCard>

      <SectionCard title="E · Risk log">
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Rule</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(data?.riskEvents ?? []).map((e) => (
              <tr key={e.eventId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(e.createdAt)}</td>
                <td className="py-2 pr-3">{e.marketId ?? "—"}</td>
                <td className="py-2 pr-3">{e.ruleCode}</td>
                <td className="py-2 pr-3">{e.severity}</td>
                <td className="py-2 pr-3">{e.action}</td>
                <td className="py-2 pr-3 text-xs text-[var(--muted)]">{e.reason}</td>
              </tr>
            ))}
            {(data?.blockedSignals ?? []).map((b) => (
              <tr key={b.signalId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(b.createdAt)}</td>
                <td className="py-2 pr-3">{b.marketId}</td>
                <td className="py-2 pr-3">{b.ruleCodes.join(", ")}</td>
                <td className="py-2 pr-3">BLOCK</td>
                <td className="py-2 pr-3">BLOCK</td>
                <td className="py-2 pr-3 text-xs text-[var(--muted)]">{b.reason}</td>
              </tr>
            ))}
            {(data?.blockedSweeperOpportunities ?? []).map((b) => (
              <tr key={b.recordId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(b.createdAt)}</td>
                <td className="py-2 pr-3">{b.marketId}</td>
                <td className="py-2 pr-3">{b.ruleCodes.join(", ")}</td>
                <td className="py-2 pr-3">BLOCK</td>
                <td className="py-2 pr-3">SWEEPER</td>
                <td className="py-2 pr-3 text-xs text-[var(--muted)]">
                  [{b.strategy}] {b.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </SectionCard>

      <SectionCard title="F · Sweeper opportunity scanner (MVP 21.1 · paper only)">
        <p className="mb-3 text-xs text-[var(--muted)]">
          Scans mock order books for sweepable setups. No wallet, no real orders, risk guard on every
          simulated trade. Blocked opportunities are logged below.
        </p>
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Strategy</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Side</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Edge</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Flags</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.sweeperOpportunities ?? []).slice(0, 30).map((o) => (
              <tr key={o.opportunityId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(o.createdAt)}</td>
                <td className="py-2 pr-3 text-xs">{o.strategy.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3">{o.marketId}</td>
                <td className="py-2 pr-3">{o.side}</td>
                <td className="py-2 pr-3">{o.suggestedPrice.toFixed(3)}</td>
                <td className="py-2 pr-3">{fmtPct(o.estimatedEdge)}</td>
                <td className="py-2 pr-3">{o.sweepScore.toFixed(3)}</td>
                <td className="py-2 pr-3 text-xs">{o.riskFlags.join(", ") || "—"}</td>
                <td className="py-2 pr-3">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <h4 className="mt-6 mb-2 text-sm font-medium">Sweeper paper trades</h4>
        <TableWrap>
          <thead>
            <tr className="border-b border-[var(--ring-pop)]/30 text-xs uppercase text-[var(--muted)]">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Strategy</th>
              <th className="py-2 pr-3">Market</th>
              <th className="py-2 pr-3">Side</th>
              <th className="py-2 pr-3">Entry</th>
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Fill</th>
              <th className="py-2 pr-3">Unrealized</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.sweeperPaperTrades ?? []).map((t) => (
              <tr key={t.tradeId} className="border-b border-[var(--ring-pop)]/10">
                <td className="py-2 pr-3 font-mono text-xs">{fmtTime(t.createdAt)}</td>
                <td className="py-2 pr-3 text-xs">{t.strategy.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3">{t.marketId}</td>
                <td className="py-2 pr-3">{t.side}</td>
                <td className="py-2 pr-3">{t.simulatedEntryPrice.toFixed(3)}</td>
                <td className="py-2 pr-3">{t.simulatedSize.toFixed(2)}</td>
                <td className="py-2 pr-3">{t.fillStatus}</td>
                <td className="py-2 pr-3">{t.unrealizedPnl.toFixed(4)}</td>
                <td className="py-2 pr-3">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </SectionCard>
    </div>
  );
}
