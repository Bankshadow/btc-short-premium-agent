"use client";

import { useCallback, useEffect, useState } from "react";
import { TELEGRAM_CONTROL_SAFETY_NOTICE } from "@/lib/telegram-control-channel/types";
import type { TelegramControlChannelState, TelegramPermissionPrompt } from "@/lib/telegram-control-channel/types";

type StatusResponse = {
  ok: boolean;
  enabled?: boolean;
  state?: TelegramControlChannelState;
  webhookUrl?: string;
  commands?: Array<{ command: string; description: string }>;
  error?: string;
};

export default function TelegramControlPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram-control/status", { cache: "no-store" });
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } catch {
      setData({ ok: false, error: "Failed to load Telegram control status" });
    } finally {
      setBusy(false);
    }
  }, []);

  const syncPinned = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/telegram-control/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendPermissionPrompt: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const prompt: TelegramPermissionPrompt | null | undefined = data?.state?.lastPermissionPrompt;

  return (
    <div className="space-y-3 text-xs text-zinc-400">
      <p className="text-[10px] text-zinc-600">{TELEGRAM_CONTROL_SAFETY_NOTICE}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !data?.enabled}
          onClick={() => void syncPinned()}
          className="rounded border border-sky-800/60 bg-sky-950/40 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-900/40 disabled:opacity-50"
        >
          Sync pinned status
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <dl className="grid gap-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Channel</dt>
          <dd className={data?.enabled ? "text-emerald-300" : "text-amber-300"}>
            {data?.enabled ? "Configured" : "Not configured"}
          </dd>
        </div>
        {data?.state?.lastSyncedAt && (
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Last sync</dt>
            <dd>{new Date(data.state.lastSyncedAt).toLocaleString()}</dd>
          </div>
        )}
        {prompt && prompt.status === "PENDING" && (
          <div className="mt-2 rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase text-amber-400/90">
              Pending · {prompt.kind}
            </p>
            <p className="mt-0.5 text-zinc-300">{prompt.summary}</p>
            <p className="mt-1 text-[10px] text-zinc-600">
              Expires {new Date(prompt.expiresAt).toLocaleTimeString()} · /approve or /deny in Telegram
            </p>
          </div>
        )}
      </dl>

      {data?.webhookUrl && (
        <div className="rounded border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">Webhook URL</p>
          <p className="mt-1 break-all font-mono text-[10px] text-zinc-500">{data.webhookUrl}</p>
          <p className="mt-1 text-[10px] text-zinc-600">
            Register with Telegram setWebhook. Commands: /status /mission /approve /deny …
          </p>
        </div>
      )}

      {data?.commands && (
        <ul className="space-y-0.5 text-[10px] text-zinc-600">
          {data.commands.map((c) => (
            <li key={c.command}>
              <span className="font-mono text-zinc-400">{c.command}</span> — {c.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
