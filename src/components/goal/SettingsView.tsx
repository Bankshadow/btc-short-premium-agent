"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import AutopilotControls from "./AutopilotControls";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import MissionModePanel from "./MissionModePanel";
import NotificationStatusPanel from "./NotificationStatusPanel";
import { useMissionSnapshot } from "./use-mission-snapshot";

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
  const { snapshot: m, busy, error, degraded, warnings, refresh } =
    useMissionSnapshot();
  const [saved, setSaved] = useState(false);
  const [serverNotifySaved, setServerNotifySaved] = useState(false);
  const [deskRiskProfile, setDeskRiskProfile] = useState<DeskRiskProfile>("aggressive");
  const [serverRiskSaved, setServerRiskSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    void fetch("/api/goal/mission-risk-settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.settings?.deskRiskProfile) {
          setDeskRiskProfile(json.settings.deskRiskProfile);
        }
      })
      .catch(() => undefined);
    void fetch("/api/goal/notification-settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.prefs) {
          setSettings((prev) => ({
            ...prev,
            notifyOnTrade: json.prefs.notifyOnTrade,
            notifyOnBlocker: json.prefs.notifyOnBlocker,
          }));
        }
      })
      .catch(() => undefined);
  }, []);

  const update = useCallback(<K extends keyof GoalSettings>(key: K, value: GoalSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    try {
      const [notifyRes, riskRes] = await Promise.all([
        fetch("/api/goal/notification-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notifyOnTrade: settings.notifyOnTrade,
            notifyOnBlocker: settings.notifyOnBlocker,
          }),
        }),
        fetch("/api/goal/mission-risk-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deskRiskProfile }),
        }),
      ]);
      const notifyJson = await notifyRes.json();
      const riskJson = await riskRes.json();
      setServerNotifySaved(notifyRes.ok && notifyJson.ok);
      setServerRiskSaved(riskRes.ok && riskJson.ok);
    } catch {
      setServerNotifySaved(false);
      setServerRiskSaved(false);
    }
  }, [settings, deskRiskProfile]);

  return (
    <GoalShell
      title="Settings"
      subtitle="Mission autopilot, environments, and risk limits. Live trading stays locked."
      activePath="/settings"
      missionSnapshot={m}
      actions={
        <>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60"
          >
            {busy ? "..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-lg bg-emerald-700/90 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-600"
          >
            {saved ? "Saved" : "Save"}
          </button>
        </>
      }
    >
      <GoalErrorBanner
        error={error}
        degraded={degraded}
        warnings={warnings}
        snapshot={m}
      />

      <MissionModePanel snapshot={m} />

      <NotificationStatusPanel snapshot={m} />

      <AutopilotControls
        automation={m.automation}
        onChanged={() => void refresh(true)}
        compact
      />
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
        <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
          <li>
            Status:{" "}
            <span
              className={
                m.binanceTestnet.status === "CONNECTED"
                  ? "text-emerald-300"
                  : m.binanceTestnet.status === "BLOCKED"
                    ? "text-rose-300"
                    : "text-amber-300"
              }
            >
              {m.binanceTestnet.status}
            </span>
          </li>
          <li>
            Reason: <span className="text-zinc-300">{m.binanceTestnet.reason}</span>
          </li>
          {m.binanceTestnet.proxyProvider && (
            <li>Proxy: {m.binanceTestnet.proxyProvider}</li>
          )}
          <li>Testnet: {m.risk.testnetStatus}</li>
          <li>
            Live trading:{" "}
            <span className="text-emerald-300">
              {m.risk.liveLocked ? "Locked (safe)" : "Unlocked"}
            </span>
          </li>
          {m.binanceTestnet.status === "BLOCKED" &&
            m.binanceTestnet.reason.toLowerCase().includes("451") && (
              <li className="text-rose-300">
                HTTP 451 — Binance blocked this region. Use Fly.io / Singapore proxy.
              </li>
            )}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/binance-testnet" className="text-xs text-emerald-300 hover:underline">
            Open testnet config →
          </Link>
          <Link href="/binance-testnet" className="text-xs text-zinc-500 hover:underline">
            Binance Testnet Debug →
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          AI aggression
        </h2>
        <p className="mt-2 text-[11px] text-zinc-500">
          Controls how often autopilot opens testnet trades across BTC, SOL, ETH, LINK, and DOGE.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-lg border px-3 py-3 text-xs ${
              deskRiskProfile === "balanced"
                ? "border-emerald-600/60 bg-emerald-950/30 text-emerald-100"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            <input
              type="radio"
              name="deskRiskProfile"
              value="balanced"
              checked={deskRiskProfile === "balanced"}
              onChange={() => {
                setDeskRiskProfile("balanced");
                setSaved(false);
              }}
              className="sr-only"
            />
            <span className="font-semibold text-zinc-200">Balanced</span>
            <p className="mt-1 text-[11px] text-zinc-500">
              Stricter data quality, fewer trades, wider take-profit.
            </p>
          </label>
          <label
            className={`cursor-pointer rounded-lg border px-3 py-3 text-xs ${
              deskRiskProfile === "aggressive"
                ? "border-amber-600/60 bg-amber-950/30 text-amber-100"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            <input
              type="radio"
              name="deskRiskProfile"
              value="aggressive"
              checked={deskRiskProfile === "aggressive"}
              onChange={() => {
                setDeskRiskProfile("aggressive");
                setSaved(false);
              }}
              className="sr-only"
            />
            <span className="font-semibold text-zinc-200">Aggressive</span>
            <p className="mt-1 text-[11px] text-zinc-500">
              Multi-coin scanner, up to 3 positions, faster rotation, WAIT→TRADE when confident.
            </p>
          </label>
        </div>
        <ul className="mt-3 space-y-1 text-[11px] text-zinc-600">
          <li>Max open positions: 3 (server default)</li>
          <li>Max trades/day: 15 · symbols: BTC, SOL, ETH, LINK, DOGE</li>
          <li>Symbol rotation: skip coin after 3 cycles without a fill</li>
        </ul>
        {serverRiskSaved && (
          <p className="mt-2 text-[11px] text-emerald-400">Server aggression profile synced.</p>
        )}
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
        <p className="mt-2 text-[11px] text-zinc-500">
          Telegram:{" "}
          <span
            className={
              m.notifications.telegramConfigured ? "text-emerald-300" : "text-amber-300"
            }
          >
            {m.notifications.telegramConfigured ? "Configured on server" : "Not configured"}
          </span>
          {m.notifications.lastAlertAt && (
            <> · Last alert {new Date(m.notifications.lastAlertAt).toLocaleString()}</>
          )}
        </p>
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
        {serverNotifySaved && (
          <p className="mt-2 text-[11px] text-emerald-400">Server notification prefs synced.</p>
        )}
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
