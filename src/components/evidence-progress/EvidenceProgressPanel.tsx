"use client";

import Link from "next/link";
import type { EvidenceProgressSnapshot } from "@/lib/evidence-progress/types";

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function learningBadge(status: string): string {
  switch (status) {
    case "LEARNED":
      return "text-emerald-400";
    case "PENDING_REVIEW":
      return "text-amber-300";
    case "EXCLUDED":
      return "text-zinc-500";
    default:
      return "text-zinc-400";
  }
}

export default function EvidenceProgressPanel({
  evidence,
  showTable = true,
  compact = false,
}: {
  evidence: EvidenceProgressSnapshot | null | undefined;
  showTable?: boolean;
  compact?: boolean;
}) {
  if (!evidence) {
    return (
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <p className="text-sm text-zinc-500">Evidence progress loading…</p>
      </section>
    );
  }

  const pct = Math.min(
    100,
    Math.round((evidence.completedTrades / evidence.requiredTrades) * 100),
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Evidence</span>
        <span className="font-mono text-zinc-200">
          {evidence.completedTrades}/{evidence.requiredTrades}
        </span>
        {evidence.evidenceSetReady && (
          <span className="text-emerald-400">ready</span>
        )}
        {!evidence.evidenceSetValid && evidence.excludedTradeCount > 0 && (
          <span className="text-amber-400">invalid excluded</span>
        )}
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4"
      data-mvp="73A"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-cyan-400/80">
            MVP 73A · {evidence.label}
          </p>
          <p className="mt-1 font-mono text-2xl text-zinc-50">
            {evidence.completedTrades}{" "}
            <span className="text-base text-zinc-500">
              / {evidence.requiredTrades}
            </span>
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>
            Win / Loss / BE: {evidence.winCount} / {evidence.lossCount} /{" "}
            {evidence.breakevenCount}
          </p>
          <p className="mt-0.5">
            Realized {usd(evidence.realizedPnl)} · avg {usd(evidence.averagePnl)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${
            evidence.evidenceSetReady ? "bg-emerald-500" : "bg-cyan-600/80"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        {evidence.remainingTrades > 0
          ? `${evidence.remainingTrades} more valid closed trade(s) for minimum evidence.`
          : "Minimum evidence set reached — testnet only; live stays locked."}
      </p>

      {evidence.currentBlocker && (
        <p className="mt-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          Blocker: {evidence.currentBlocker}
        </p>
      )}

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <p className="text-zinc-500">Next expected action</p>
          <p className="text-zinc-300">{evidence.nextExpectedAction}</p>
        </div>
        {evidence.lastCompletedTrade && (
          <div>
            <p className="text-zinc-500">Last completed trade</p>
            <p className="font-mono text-zinc-200">
              #{evidence.lastCompletedTrade.evidenceIndex}{" "}
              {evidence.lastCompletedTrade.symbol}{" "}
              {evidence.lastCompletedTrade.result}{" "}
              {usd(evidence.lastCompletedTrade.netPnl)}
            </p>
            {evidence.lastCompletedTrade.closeReason && (
              <p className="mt-0.5 text-zinc-500">
                {evidence.lastCompletedTrade.closeReason}
              </p>
            )}
          </div>
        )}
      </div>

      {(evidence.missingDecisionLogId > 0 ||
        evidence.missingCloseJournal > 0 ||
        evidence.missingPnl > 0 ||
        evidence.duplicateTradeWarnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-[11px] text-amber-300/90">
          {evidence.missingDecisionLogId > 0 && (
            <li>Missing decisionLogId: {evidence.missingDecisionLogId}</li>
          )}
          {evidence.missingCloseJournal > 0 && (
            <li>Missing CLOSED journal: {evidence.missingCloseJournal}</li>
          )}
          {evidence.missingPnl > 0 && (
            <li>Missing PnL: {evidence.missingPnl}</li>
          )}
          {evidence.duplicateTradeWarnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {evidence.validityNotes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-zinc-500">
          {evidence.validityNotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}

      {showTable && evidence.validTrades.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Symbol</th>
                <th className="py-2 pr-2">Result</th>
                <th className="py-2 pr-2">PnL</th>
                <th className="py-2 pr-2">Strategy</th>
                <th className="py-2 pr-2">decisionLogId</th>
                <th className="py-2 pr-2">Close reason</th>
                <th className="py-2">Learning</th>
              </tr>
            </thead>
            <tbody>
              {evidence.validTrades.map((row) => (
                <tr
                  key={row.tradeId}
                  className="border-b border-zinc-900/80 text-zinc-300"
                >
                  <td className="py-2 pr-2 font-mono">{row.evidenceIndex}</td>
                  <td className="py-2 pr-2">{row.symbol}</td>
                  <td className="py-2 pr-2">{row.result}</td>
                  <td className="py-2 pr-2 font-mono">{usd(row.netPnl)}</td>
                  <td className="py-2 pr-2">{row.strategy ?? "—"}</td>
                  <td className="max-w-[120px] truncate py-2 pr-2 font-mono text-zinc-500">
                    {row.decisionLogId}
                  </td>
                  <td className="max-w-[160px] truncate py-2 pr-2 text-zinc-500">
                    {row.closeReason ?? "—"}
                  </td>
                  <td className={`py-2 ${learningBadge(row.learningStatus)}`}>
                    {row.learningStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTable && evidence.excludedTrades.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-zinc-500">
            Excluded from evidence ({evidence.excludedTrades.length})
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
            {evidence.excludedTrades.map((row) => (
              <li key={`${row.tradeId}-${row.reason}`}>
                {row.symbol}: {row.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Testnet evidence only · no live auto-enable · no risk increase to rush 12
        trades.
        <Link href="/testnet-monitor" className="ml-2 text-cyan-500/80 hover:underline">
          Testnet monitor →
        </Link>
      </p>
    </section>
  );
}
