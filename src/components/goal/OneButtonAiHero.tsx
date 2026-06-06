"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OneButtonAiStatus } from "@/lib/one-button-ai-mode/types";

const LABEL_STYLES: Record<string, string> = {
  "Start AI": "from-violet-700 to-indigo-600 hover:from-violet-600 hover:to-indigo-500",
  "Continue Monitoring": "from-cyan-800 to-teal-700 hover:from-cyan-700 hover:to-teal-600",
  "Review Trade": "from-amber-800 to-orange-700 hover:from-amber-700 hover:to-orange-600",
  "Approve Testnet Order": "from-emerald-800 to-cyan-700 hover:from-emerald-700 hover:to-cyan-600",
  "Close Position": "from-rose-800 to-red-700 hover:from-rose-700 hover:to-red-600",
  "Generate Report": "from-indigo-800 to-violet-700 hover:from-indigo-700 hover:to-violet-600",
  "Resolve Issue": "from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500",
};

export default function OneButtonAiHero({
  onNeedsConfirm,
  onAfterRun,
}: {
  onNeedsConfirm: (mode: "execute" | "close") => void;
  onAfterRun?: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OneButtonAiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/one-button-ai/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Status failed");
      setStatus(data.status as OneButtonAiStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const run = useCallback(async () => {
    if (!status) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (status.state.requiresClientConfirm && status.state.confirmMode) {
        onNeedsConfirm(status.state.confirmMode);
        setMessage(status.state.detail);
        return;
      }

      const res = await fetch("/api/one-button-ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: status.state.action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? data.summary ?? "Action failed");

      if (data.requiresClientConfirm && data.confirmMode) {
        onNeedsConfirm(data.confirmMode);
        setMessage(data.summary);
        return;
      }

      setMessage(data.summary);
      if (data.navigateTo) router.push(data.navigateTo);
      await refresh();
      onAfterRun?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }, [status, onNeedsConfirm, onAfterRun, refresh, router]);

  const label = status?.state.label ?? "Start AI";
  const btnStyle =
    LABEL_STYLES[label] ?? "from-violet-700 to-indigo-600 hover:from-violet-600 hover:to-indigo-500";

  return (
    <section className="rounded-xl border border-violet-900/40 bg-gradient-to-br from-violet-950/40 to-zinc-950/60 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-violet-400/90">
            MVP 86 · One Button AI Mode
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {status?.state.reason ?? "AI picks the next safe action for you."}
          </p>
        </div>
        <p className="text-[10px] text-zinc-600">Testnet only · live locked</p>
      </div>

      <button
        type="button"
        disabled={busy || !status}
        onClick={() => void run()}
        className={`w-full rounded-xl bg-gradient-to-r px-6 py-4 text-lg font-semibold text-white shadow-lg transition disabled:opacity-50 ${btnStyle}`}
      >
        {busy ? "Working…" : label}
      </button>

      {status && (
        <p className="mt-3 text-xs text-zinc-400">{status.state.detail}</p>
      )}

      {status?.blockers.length ? (
        <ul className="mt-2 list-inside list-disc text-[11px] text-amber-300/90">
          {status.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      {message && (
        <p className="mt-2 rounded border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-2 rounded border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}
