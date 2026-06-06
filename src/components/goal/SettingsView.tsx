"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import GoalShell from "./GoalShell";

const SETTINGS_KEY = "btc-desk:goal-settings";

interface GoalSettings {
  startCapital: number;
  targetCapital: number;
  environmentMode: "PAPER" | "TESTNET" | "PAPER_TESTNET" | "LIVE";
  showPaper: boolean;
  showTestnet: boolean;
  showLive: boolean;
  dailyLossLimitPct: number;
  notifyOnTrade: boolean;
  notifyOnBlocker: boolean;
  advancedMode: boolean;
}

const DEFAULT_SETTINGS: GoalSettings = {
  startCapital: 1_000,
  targetCapital: 10_000,
  environmentMode: "PAPER_TESTNET",
  showPaper: true,
  showTestnet: true,
  showLive: false,
  dailyLossLimitPct: 3,
  notifyOnTrade: true,
  notifyOnBlocker: true,
  advancedMode: false,
};

interface BinanceStatus {
  configured: boolean;
  testnetEnabled: boolean;
  connected: boolean;
  network: string | null;
}

function loadSettings(): GoalSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GoalSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export default function SettingsView() {
  const [settings, setSettings] = useState<GoalSettings>(DEFAULT_SETTINGS);
  const [binance, setBinance] = useState<BinanceStatus | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    void (async () => {
      try {
        const res = await fetch("/api/exchange/binance/status", { cache: "no-store" });
        const json = await res.json();
        const status = json?.status;
        if (res.ok && status) {
          setBinance({
            configured: Boolean(status.configured),
            testnetEnabled: Boolean(status.testnetEnabled),
            connected: Boolean(status.connected),
            network: status.upstreamBaseUrl ?? status.baseUrl ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const update = useCallback(<K extends keyof GoalSettings>(key: K, value: GoalSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
  }, [settings]);

  return (
    <GoalShell
      title="Settings"
      subtitle="Configure your mission, visible environments, and risk limits. Live trading stays locked here."
      activePath="/settings"
      actions={
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-emerald-700/90 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-600"
        >
          {saved ? "Saved" : "Save"}
        </button>
      }
    >
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mission</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Start capital ($)
            <input
              type="number"
              value={settings.startCapital}
              onChange={(e) => update("startCapital", Number(e.target.value))}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Target capital ($)
            <input
              type="number"
              value={settings.targetCapital}
              onChange={(e) => update("targetCapital", Number(e.target.value))}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Environment mode & visibility
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Default mode
            <select
              value={settings.environmentMode}
              onChange={(e) => update("environmentMode", e.target.value as GoalSettings["environmentMode"])}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100"
            >
              <option value="PAPER">Paper only</option>
              <option value="TESTNET">Testnet only</option>
              <option value="PAPER_TESTNET">Paper + Testnet (combined)</option>
              <option value="LIVE">Live (shown separately)</option>
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-xs text-zinc-400">
            <span className="text-zinc-500">Show environments</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showPaper} onChange={(e) => update("showPaper", e.target.checked)} />
              Paper / Shadow
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showTestnet} onChange={(e) => update("showTestnet", e.target.checked)} />
              Testnet
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showLive} onChange={(e) => update("showLive", e.target.checked)} />
              Live (always shown separately)
            </label>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Live metrics are always kept separate from practice money, and demo data is never mixed in.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Binance testnet connection
        </h2>
        {!binance ? (
          <p className="mt-2 text-xs text-zinc-500">Checking connection…</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            <li>
              Status:{" "}
              <span className={binance.connected ? "text-emerald-300" : "text-amber-300"}>
                {binance.connected
                  ? "Binance Testnet is connected."
                  : "Binance Testnet is not connected yet."}
              </span>
            </li>
            <li>API keys: {binance.configured ? "Configured" : "Not configured"}</li>
            <li>Network: {binance.network ?? "—"}</li>
          </ul>
        )}
        <Link href="/binance-testnet" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
          Open testnet config →
        </Link>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Risk limits</h2>
        <label className="mt-3 block text-xs text-zinc-400">
          Daily loss limit (%)
          <input
            type="number"
            value={settings.dailyLossLimitPct}
            onChange={(e) => update("dailyLossLimitPct", Number(e.target.value))}
            className="mt-1 w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
          />
        </label>
        <p className="mt-2 text-[11px] text-zinc-600">
          The risk engine still enforces server-side hard limits regardless of this preference.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notifications</h2>
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-zinc-400">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.notifyOnTrade} onChange={(e) => update("notifyOnTrade", e.target.checked)} />
            Notify me when AI opens or closes a trade
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.notifyOnBlocker} onChange={(e) => update("notifyOnBlocker", e.target.checked)} />
            Notify me when AI is blocked or needs action
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Advanced mode</h2>
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={settings.advancedMode} onChange={(e) => update("advancedMode", e.target.checked)} />
          Show advanced modules (agents, ledger, validation, governance, etc.)
        </label>
        <p className="mt-2 text-[11px] text-zinc-600">
          Advanced pages are always reachable from the &quot;Advanced view&quot; button in the header.
        </p>
      </section>

      <p className="text-[11px] text-zinc-600">
        Need the full workspace settings?{" "}
        <Link href="/settings/workspace" className="text-emerald-300 hover:underline">
          Open workspace settings
        </Link>
        .
      </p>
    </GoalShell>
  );
}
