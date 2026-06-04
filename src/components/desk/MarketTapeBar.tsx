"use client";

import type { AnalyzeApiResponse } from "@/lib/types/market";
import { formatPct } from "@/components/dashboard/utils";

interface MarketTapeBarProps {
  data: AnalyzeApiResponse | null;
}

export default function MarketTapeBar({ data }: MarketTapeBarProps) {
  const snap = data?.step1_marketSnapshot ?? data?.marketSnapshot;
  if (!snap || snap.spotPrice <= 0) {
    return (
      <div className="desk-panel-muted px-4 py-2 font-mono text-xs text-zinc-500">
        Market tape loading…
      </div>
    );
  }

  const items = [
    { label: "BTC", value: `$${snap.spotPrice.toLocaleString()}`, highlight: true },
    {
      label: "24h",
      value: formatPct(snap.priceChange24hPct ?? 0),
      highlight: false,
      positive: (snap.priceChange24hPct ?? 0) >= 0,
    },
    { label: "IV/HV", value: snap.ivHvRatio.toFixed(2), highlight: false },
    { label: "Fund", value: `${(snap.fundingRate * 100).toFixed(3)}%`, highlight: false },
    {
      label: "OI 24h",
      value:
        snap.oiChange24hPct != null
          ? formatPct(snap.oiChange24hPct)
          : "—",
      highlight: false,
    },
    {
      label: "Regime",
      value: data?.tradingDesk?.marketRegime ?? "—",
      highlight: true,
    },
  ];

  return (
    <div className="desk-panel-muted flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/80">
        Tape
      </span>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase text-zinc-500">{item.label}</span>
          <span
            className={`font-mono text-sm ${
              item.highlight
                ? "font-semibold text-zinc-100"
                : "positive" in item && item.positive === false
                  ? "text-rose-400"
                  : "positive" in item && item.positive
                    ? "text-emerald-400"
                    : "text-zinc-300"
            }`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
