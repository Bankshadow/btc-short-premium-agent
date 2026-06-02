import type { OptionCandidate } from "@/lib/types/market";
import { formatUsd, isSweetSpotDelta } from "./utils";

interface OptionSweetSpotTableProps {
  candidates: OptionCandidate[];
}

function CandidateTable({
  title,
  rows,
}: {
  title: string;
  rows: OptionCandidate[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
        <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {title}
        </h3>
        <p className="text-sm text-zinc-500">No candidates in sweet-spot range.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
      <h3 className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {title}
      </h3>
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <th className="px-4 py-2 font-medium">Strike</th>
            <th className="px-4 py-2 font-medium">Delta</th>
            <th className="px-4 py-2 font-medium">Bid</th>
            <th className="px-4 py-2 font-medium">Ask</th>
            <th className="px-4 py-2 font-medium">Mark</th>
            <th className="px-4 py-2 font-medium">IV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sweet = isSweetSpotDelta(row.delta);
            return (
              <tr
                key={row.symbol}
                className={`border-b border-zinc-50 last:border-0 dark:border-zinc-900 ${
                  sweet ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-medium">
                  {formatUsd(row.strike)}
                  {sweet && (
                    <span className="ml-2 rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                      Sweet
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono">{row.delta.toFixed(3)}</td>
                <td className="px-4 py-2.5">${row.bid.toFixed(0)}</td>
                <td className="px-4 py-2.5">${row.ask.toFixed(0)}</td>
                <td className="px-4 py-2.5">${row.markPrice.toFixed(0)}</td>
                <td className="px-4 py-2.5">{row.impliedVolatility.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function OptionSweetSpotTable({
  candidates,
}: OptionSweetSpotTableProps) {
  const inRange = candidates.filter((c) => {
    const abs = Math.abs(c.delta);
    return abs >= 0.08 && abs <= 0.18;
  });

  const sortByDelta = (a: OptionCandidate, b: OptionCandidate) =>
    Math.abs(Math.abs(a.delta) - 0.14) - Math.abs(Math.abs(b.delta) - 0.14);

  const calls = inRange
    .filter((c) => c.optionType === "call")
    .sort(sortByDelta);
  const puts = inRange
    .filter((c) => c.optionType === "put")
    .sort(sortByDelta);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Option Chain
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Sweet Spot Table
        </h2>
        <p className="text-xs text-zinc-500">
          |Delta| 0.08–0.18 shown · 0.13–0.15 highlighted
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <CandidateTable title="Call Candidates" rows={calls} />
        <CandidateTable title="Put Candidates" rows={puts} />
      </div>
    </section>
  );
}
