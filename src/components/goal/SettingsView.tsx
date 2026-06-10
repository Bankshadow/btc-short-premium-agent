"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import AutopilotControls from "./AutopilotControls";
import GoalErrorBanner from "./GoalErrorBanner";
import GoalShell from "./GoalShell";
import MissionModePanel from "./MissionModePanel";
import NotificationStatusPanel from "./NotificationStatusPanel";
import {
  DEFAULT_GOAL_SETTINGS,
  loadGoalSettings,
  saveGoalSettings,
  type GoalSettings,
} from "@/lib/ux/goal-nav-spec";
import { useMissionSnapshot } from "./use-mission-snapshot";

export default function SettingsView() {
  const [settings, setSettings] = useState<GoalSettings>(DEFAULT_GOAL_SETTINGS);
  const { snapshot: m, busy, error, degraded, warnings, refresh } =
    useMissionSnapshot();
  const [saved, setSaved] = useState(false);
  const [serverNotifySaved, setServerNotifySaved] = useState(false);
  const [deskRiskProfile, setDeskRiskProfile] = useState<DeskRiskProfile>("aggressive");
  const [serverRiskSaved, setServerRiskSaved] = useState(false);

  useEffect(() => {
    setSettings(loadGoalSettings());
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
    saveGoalSettings(settings);
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
      subtitle="Mission, risk limits, testnet, notifications, skills, and advanced mode."
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

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mission</h2>
        <div className="mt-3 space-y-4">
          <MissionModePanel snapshot={m} />
          <AutopilotControls
            automation={m.automation}
            onChanged={() => void refresh(true)}
            compact
          />
          <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Risk limits
        </h2>
        <label className="mt-3 block text-xs text-zinc-400">
          Daily loss limit (%)
          <input
            type="number"
            value={settings.dailyLossLimitPct}
            onChange={(e) => update("dailyLossLimitPct", Number(e.target.value))}
            className="mt-1 w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-zinc-100"
          />
        </label>
        <p className="mt-3 text-[11px] text-zinc-500">AI aggression profile</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
            <p className="mt-1 text-[11px] text-zinc-500">Stricter data quality, fewer trades.</p>
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
            <p className="mt-1 text-[11px] text-zinc-500">Multi-coin scanner, faster rotation.</p>
          </label>
        </div>
        {serverRiskSaved && (
          <p className="mt-2 text-[11px] text-emerald-400">Server risk profile synced.</p>
        )}
        <p className="mt-2 text-[11px] text-zinc-600">
          Server-side hard limits always apply regardless of these preferences.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Binance/Testnet
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
          <li>
            Live trading:{" "}
            <span className="text-emerald-300">
              {m.risk.liveLocked ? "Locked (safe)" : "Unlocked"}
            </span>
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/binance-testnet" className="text-xs text-emerald-300 hover:underline">
            Open testnet config →
          </Link>
          <Link href="/advanced/engine-health" className="text-xs text-zinc-500 hover:underline">
            Engine health →
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Notifications
        </h2>
        <NotificationStatusPanel snapshot={m} />
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-zinc-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.notifyOnTrade}
              onChange={(e) => update("notifyOnTrade", e.target.checked)}
            />
            Notify when AI opens or closes a trade
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.notifyOnBlocker}
              onChange={(e) => update("notifyOnBlocker", e.target.checked)}
            />
            Notify when AI is blocked or needs action
          </label>
        </div>
        {serverNotifySaved && (
          <p className="mt-2 text-[11px] text-emerald-400">Server notification prefs synced.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Skills</h2>
        <p className="mt-2 text-xs text-zinc-400">
          Strategy skills, cron agents, and registry — configure how the desk analyzes and trades.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/settings/cron" className="text-xs text-emerald-300 hover:underline">
            Cron interval & AI agents →
          </Link>
          <Link href="/strategies" className="text-xs text-emerald-300 hover:underline">
            Strategy registry →
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Advanced toggle
        </h2>
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={settings.advancedMode}
            onChange={(e) => update("advancedMode", e.target.checked)}
          />
          Enable advanced module shortcuts
        </label>
        <p className="mt-2 text-[11px] text-zinc-600">
          Advanced is always available from the main nav.{" "}
          <Link href="/advanced" className="text-emerald-300 hover:underline">
            Open Advanced →
          </Link>
        </p>
      </section>
    </GoalShell>
  );
}
