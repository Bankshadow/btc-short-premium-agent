import type { MarketSnapshot as MarketSnapshotType } from "@/lib/types/market";
import { formatPct, formatUsd } from "./utils";

interface MarketSnapshotProps {
  snapshot: MarketSnapshotType;
}

export default function MarketSnapshot({ snapshot }: MarketSnapshotProps) {
  const hasFunding = snapshot.fundingRate !== 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Market Snapshot
        </p>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {snapshot.symbol}
        </h2>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt className="text-xs text-zinc-500">BTC Price</dt>
          <dd className="text-xl font-semibold">{formatUsd(snapshot.spotPrice)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">24h Change</dt>
          <dd
            className={`text-lg font-medium ${
              (snapshot.priceChange24hPct ?? 0) >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatPct(snapshot.priceChange24hPct)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Volume 24h</dt>
          <dd className="text-lg font-medium">
            {snapshot.volume24hBtc > 0
              ? `${snapshot.volume24hBtc.toLocaleString()} BTC`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Funding</dt>
          <dd className="text-lg font-medium">
            {hasFunding
              ? `${(snapshot.fundingRate * 100).toFixed(4)}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">HV 30D</dt>
          <dd className="text-lg font-medium">{snapshot.hv30.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">IV/HV Ratio</dt>
          <dd
            className={`text-lg font-semibold ${
              snapshot.ivHvRatio >= 1.15
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {snapshot.ivHvRatio.toFixed(2)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
