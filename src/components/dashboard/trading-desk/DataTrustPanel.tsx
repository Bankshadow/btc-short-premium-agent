"use client";

import type {
  ConflictGateResult,
  DataConfidenceResult,
  DataProvenanceField,
  StrategyConflictAnalysis,
} from "@/lib/data-trust/types";

function gradeClass(grade: string): string {
  if (grade === "HIGH") return "text-emerald-400";
  if (grade === "MEDIUM") return "text-amber-300";
  if (grade === "LOW") return "text-orange-400";
  return "text-rose-400";
}

function sourceBadge(source: string): string {
  const map: Record<string, string> = {
    BYBIT: "bg-sky-950/60 text-sky-300 ring-sky-800/50",
    COINGLASS: "bg-violet-950/60 text-violet-300 ring-violet-800/50",
    MANUAL: "bg-amber-950/60 text-amber-300 ring-amber-800/50",
    MOCK: "bg-rose-950/60 text-rose-300 ring-rose-800/50",
    MISSING: "bg-zinc-900 text-zinc-500 ring-zinc-700",
    DERIVED: "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
    LOCAL_STORAGE: "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
  };
  return map[source] ?? "bg-zinc-900 text-zinc-500 ring-zinc-700";
}

interface DataTrustPanelProps {
  dataTrust: DataConfidenceResult;
  dataProvenance: DataProvenanceField[];
  conflictAnalysis: StrategyConflictAnalysis;
  conflictGate: ConflictGateResult;
}

export default function DataTrustPanel({
  dataTrust,
  dataProvenance,
  conflictAnalysis,
  conflictGate,
}: DataTrustPanelProps) {
  const staleOrMissing = dataProvenance.filter(
    (p) =>
      p.confidence === "LOW" ||
      p.confidence === "CRITICAL" ||
      p.source === "MISSING",
  );

  return (
    <section className="desk-panel px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="desk-section-title text-cyan-400/90">
            MVP 17 · Data trust & conflict control
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Reliability layer before committee TRADE — analysis & paper only.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            Data trust score
          </p>
          <p className={`font-mono text-2xl font-bold ${gradeClass(dataTrust.grade)}`}>
            {dataTrust.score}
            <span className="ml-1 text-sm font-medium text-zinc-500">
              / 100 · {dataTrust.grade}
            </span>
          </p>
        </div>
      </div>

      {conflictGate.tradeBlocked && (
        <div className="mt-4 rounded-lg border border-rose-800/60 bg-rose-950/40 px-4 py-3">
          <p className="text-sm font-bold tracking-wide text-rose-300">
            TRADE BLOCKED BY DATA TRUST / CONFLICT GATE
          </p>
          <p className="mt-1 text-xs text-rose-200/80">{conflictGate.blockReason}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
          <p className="desk-section-title">Trade gate status</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              conflictGate.tradeBlocked ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {conflictGate.tradeBlocked ? "BLOCKED" : "OPEN"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">{conflictGate.statusLabel}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
          <p className="desk-section-title">Agent conflict meter</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className={`h-full transition-all ${
                conflictAnalysis.conflictLevel === "CRITICAL" ||
                conflictAnalysis.conflictLevel === "HIGH"
                  ? "bg-rose-500"
                  : conflictAnalysis.conflictLevel === "MEDIUM"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${conflictAnalysis.conflictScore}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            {conflictAnalysis.conflictScore}/100 · {conflictAnalysis.conflictLevel}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
          <p className="desk-section-title">Paper-only flag</p>
          <p className="mt-1 text-sm text-zinc-300">
            {conflictGate.paperOnlyRecommended ? "Yes — reduced confidence" : "No"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
          <p className="desk-section-title">Trade allowed (data)</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              dataTrust.tradeAllowed ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {dataTrust.tradeAllowed ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {(dataTrust.criticalIssues.length > 0 || dataTrust.warnings.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {dataTrust.criticalIssues.length > 0 && (
            <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2.5">
              <p className="desk-section-title text-rose-400/90">Critical issues</p>
              <ul className="mt-2 space-y-1 text-[11px] text-rose-200/90">
                {dataTrust.criticalIssues.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
          {dataTrust.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-900/30 bg-amber-950/15 px-3 py-2.5">
              <p className="desk-section-title text-amber-500/80">
                Stale / missing warnings
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-[11px] text-amber-200/80">
                {dataTrust.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {conflictAnalysis.conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
          <p className="desk-section-title">Conflict details</p>
          <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-400">
            {conflictAnalysis.conflicts.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-amber-600">◆</span>
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-600">
            Suggested desk action: {conflictAnalysis.suggestedAction}
          </p>
        </div>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-300">
          Data source map ({dataProvenance.length} fields)
          <span className="ml-2 opacity-50 group-open:hidden">▸</span>
          <span className="ml-2 hidden opacity-50 group-open:inline">▾</span>
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-2 py-1.5">Field</th>
                <th className="px-2 py-1.5">Source</th>
                <th className="px-2 py-1.5">Conf.</th>
                <th className="px-2 py-1.5">Age (s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-400">
              {dataProvenance.map((row) => (
                <tr key={row.fieldName} className="hover:bg-zinc-900/50">
                  <td className="px-2 py-1.5 text-zinc-300">{row.fieldName}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-block rounded px-1 py-0.5 ring-1 ${sourceBadge(row.source)}`}
                    >
                      {row.source}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 ${gradeClass(row.confidence)}`}>
                    {row.confidence}
                  </td>
                  <td className="px-2 py-1.5 font-mono">
                    {row.freshnessSeconds ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staleOrMissing.length > 0 && (
          <p className="mt-2 text-[10px] text-zinc-600">
            {staleOrMissing.length} field(s) flagged stale, missing, or low confidence.
          </p>
        )}
      </details>
    </section>
  );
}
