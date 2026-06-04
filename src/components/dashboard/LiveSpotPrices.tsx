"use client";

import type { LiveMarketResponse, SpotQuote } from "@/lib/types/market";
import {
  fetchBrowserBtcSpotQuote,
  fetchBrowserEthSpotQuote,
} from "@/lib/bybit/fetch-spot-quotes";
import { useCallback, useEffect, useState } from "react";
import { formatPct } from "./utils";

function formatSpotUsd(value: number, symbol: string): string {
  const fractionDigits = symbol.startsWith("ETH") ? 2 : 0;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function changeClass(value: number): string {
  return value >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

function SpotCard({
  label,
  quote,
}: {
  label: string;
  quote: SpotQuote;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/90 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold text-zinc-100">
        {formatSpotUsd(quote.price, quote.symbol)}
      </p>
      <p className={`mt-1 text-sm font-medium ${changeClass(quote.priceChange24hPct)}`}>
        24h {formatPct(quote.priceChange24hPct)}
      </p>
    </div>
  );
}

export default function LiveSpotPrices() {
  const [market, setMarket] = useState<LiveMarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      try {
        const response = await fetch("/api/market", { cache: "no-store" });

        if (response.ok) {
          const data = (await response.json()) as LiveMarketResponse;
          setMarket(data);
          return;
        }
      } catch {
        // Fall through to browser fetch
      }

      const [btcTicker, eth] = await Promise.all([
        fetchBrowserBtcSpotQuote(),
        fetchBrowserEthSpotQuote(),
      ]);

      setMarket({
        btc: {
          symbol: "BTCUSDT",
          spotPrice: btcTicker.price,
          timestamp: btcTicker.timestamp,
          hv30: 0,
          iv: 0,
          ivHvRatio: 0,
          ivRank: 0,
          ivPercentile: 0,
          fundingRate: 0,
          openInterestBtc: 0,
          oiChange24hPct: null,
          oiChange1hPct: null,
          volume24hBtc: 0,
          volumeChange24hPct: null,
          priceChange24hPct: btcTicker.priceChange24hPct,
        },
        eth,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load live prices.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  if (loading && !market) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-100/80 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
        Loading live BTC / ETH prices…
      </section>
    );
  }

  if (error && !market) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        Live prices unavailable: {error}
      </section>
    );
  }

  if (!market) return null;

  const btcQuote: SpotQuote = {
    symbol: market.btc.symbol,
    price: market.btc.spotPrice,
    priceChange24hPct: market.btc.priceChange24hPct ?? 0,
    timestamp: market.btc.timestamp,
  };

  return (
    <section className="desk-panel p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Live spot (Bybit public API)
          </p>
          <p className="text-xs text-zinc-400">Display only — analysis engine uses BTC</p>
        </div>
        <button
          type="button"
          onClick={() => void loadPrices()}
          className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SpotCard label="BTC / USDT" quote={btcQuote} />
        <SpotCard label="ETH / USDT" quote={market.eth} />
      </div>
    </section>
  );
}
