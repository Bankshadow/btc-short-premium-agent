"use client";

import { useCallback, useState } from "react";
import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

export default function NotificationStatusPanel({
  snapshot: m,
}: {
  snapshot: MissionFlowSnapshot;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testAlert = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/goal/test-notification", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Test failed");
      if (json.alert?.sent) {
        setMessage("Test alert sent to Telegram.");
      } else {
        setMessage(
          json.alert?.skipped ??
            (json.telegramConfigured
              ? "Alert skipped by notification preferences."
              : "Telegram not configured on server."),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Mission notifications
      </h2>
      <dl className="mt-3 space-y-2 text-xs text-zinc-400">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Telegram</dt>
          <dd
            className={
              m.notifications.telegramConfigured ? "text-emerald-300" : "text-amber-300"
            }
          >
            {m.notifications.telegramConfigured ? "Configured" : "Not configured"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Trade alerts</dt>
          <dd>{m.notifications.notifyOnTrade ? "On" : "Off"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Blocker alerts</dt>
          <dd>{m.notifications.notifyOnBlocker ? "On" : "Off"}</dd>
        </div>
        {m.notifications.lastAlertAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Last alert</dt>
            <dd>{new Date(m.notifications.lastAlertAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>
      {!m.notifications.telegramConfigured && (
        <p className="mt-3 text-[11px] text-amber-300/90">
          Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel env to receive autopilot alerts.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void testAlert()}
        className="mt-3 rounded-lg border border-cyan-800/60 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send test notification"}
      </button>
      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
