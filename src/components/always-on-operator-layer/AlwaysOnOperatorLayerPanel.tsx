"use client";

import type { AlwaysOnOperatorLayerSnapshot } from "@/lib/always-on-operator-layer/types";

export function AlwaysOnOperatorLayerBadge({
  snapshot,
}: {
  snapshot: AlwaysOnOperatorLayerSnapshot | null | undefined;
}) {
  if (!snapshot?.heartbeat.lastTickAt) return null;

  const tone = snapshot.actionRequired
    ? "text-amber-300 border-amber-900/50 bg-amber-950/20"
    : "text-sky-300 border-sky-900/50 bg-sky-950/20";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${tone}`}
      data-mvp="93"
      title={snapshot.nextAction}
    >
      Operator {snapshot.actionRequired ? "ACTION" : "ON"}
      <span className="opacity-70">· tick {snapshot.heartbeat.tickCount}</span>
    </span>
  );
}

export function AlwaysOnOperatorLayerPanel({
  snapshot,
}: {
  snapshot: AlwaysOnOperatorLayerSnapshot | null | undefined;
}) {
  if (!snapshot) {
    return <p className="text-sm text-zinc-500">Operator layer loading…</p>;
  }

  return (
    <div className="space-y-4" data-mvp="93">
      <p className="text-sm text-zinc-300">
        {snapshot.actionRequired ? "Action required" : "Monitoring active"} ·{" "}
        {snapshot.nextAction}
      </p>

      <dl className="grid gap-2 text-[11px] sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Last tick</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.heartbeat.lastTickAt
              ? new Date(snapshot.heartbeat.lastTickAt).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">BTC price</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.btcPrice != null
              ? `$${snapshot.btcPrice.toLocaleString()}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Open positions</dt>
          <dd className="font-mono text-zinc-300">{snapshot.openPositionCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Daily PnL</dt>
          <dd className="font-mono text-zinc-300">${snapshot.dailyPnlUsd.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Mission mode</dt>
          <dd className="font-mono text-zinc-300">{snapshot.missionMode ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Telegram notified</dt>
          <dd className="font-mono text-zinc-300">
            {snapshot.telegramNotified ? "yes" : "no"}
          </dd>
        </div>
      </dl>

      {snapshot.steps.length > 0 && (
        <ul className="space-y-1 text-xs text-zinc-400">
          {snapshot.steps.map((s) => (
            <li key={s.step}>
              · {s.step.replace(/_/g, " ")} — {s.ok ? "ok" : "fail"} — {s.summary}
            </li>
          ))}
        </ul>
      )}

      {snapshot.alerts.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-200/90">
          {snapshot.alerts.map((a) => (
            <li key={a.alertId}>
              · [{a.severity}] {a.title}: {a.message}
            </li>
          ))}
        </ul>
      )}

      {snapshot.dailyReportSummary && (
        <p className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-300">
          Daily report: {snapshot.dailyReportSummary}
        </p>
      )}

      <p className="text-[10px] text-zinc-600">{snapshot.safetyNotice}</p>
    </div>
  );
}
