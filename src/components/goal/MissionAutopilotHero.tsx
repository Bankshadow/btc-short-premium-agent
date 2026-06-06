"use client";

import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";

function modeLabel(m: MissionFlowSnapshot): {
  label: string;
  detail: string;
  tone: "active" | "paused" | "manual" | "offline";
} {
  if (m.binanceTestnet.status !== "CONNECTED") {
    return {
      label: "Waiting for testnet",
      detail: "Connect Binance Testnet so autopilot can trade and learn.",
      tone: "offline",
    };
  }
  if (!m.automation.enabled || m.automation.paused) {
    return {
      label: m.automation.paused ? "Autopilot paused" : "Schedule off",
      detail: m.automation.paused
        ? "Resume autopilot to run analyze → trade → learn every 15 minutes."
        : "Enable scheduled cycles so AI runs without manual clicks.",
      tone: "paused",
    };
  }
  if (m.automation.autoExecuteEnabled) {
    return {
      label: "Fully automatic",
      detail:
        "AI analyzes markets, executes testnet trades, and records lessons on schedule — no Start AI click needed.",
      tone: "active",
    };
  }
  return {
    label: "Analyze automatic · trades need confirm",
    detail:
      "Background cycles run every 15 min. TRADE signals still need double-confirm in the modal until auto-execute is enabled.",
    tone: "manual",
  };
}

const TONE_STYLES = {
  active: "border-emerald-900/50 bg-emerald-950/25",
  paused: "border-amber-900/50 bg-amber-950/20",
  manual: "border-cyan-900/50 bg-cyan-950/20",
  offline: "border-zinc-800/80 bg-zinc-950/40",
} as const;

const DOT_STYLES = {
  active: "bg-emerald-400 animate-pulse",
  paused: "bg-amber-400",
  manual: "bg-cyan-400",
  offline: "bg-zinc-500",
} as const;

export default function MissionAutopilotHero({
  snapshot: m,
  onRunNow,
  running,
}: {
  snapshot: MissionFlowSnapshot;
  onRunNow: () => void;
  running: boolean;
}) {
  const mode = modeLabel(m);
  const hasCycle = Boolean(m.lastCycleAt);

  return (
    <section className={`rounded-xl border p-5 ${TONE_STYLES[mode.tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_STYLES[mode.tone]}`} />
            <p className="text-xs uppercase tracking-wide text-zinc-400">Mission autopilot</p>
          </div>
          <p className="mt-2 text-xl font-semibold text-zinc-50">{mode.label}</p>
          <p className="mt-1 text-sm text-zinc-400">{mode.detail}</p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={onRunNow}
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {running ? "Running…" : "Run cycle now"}
        </button>
      </div>

      <dl className="mt-4 grid gap-3 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-zinc-500">AI state</dt>
          <dd className="font-mono text-zinc-200">{hasCycle ? m.aiStatus.state : "BOOTSTRAPPING"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Schedule</dt>
          <dd>
            {m.automation.enabled && !m.automation.paused
              ? `Every ${m.automation.intervalMinutes} min`
              : "Off"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last cycle</dt>
          <dd>
            {m.lastCycleAt ? new Date(m.lastCycleAt).toLocaleString() : "Starting soon…"}
            {m.lastVerdict ? ` · ${m.lastVerdict}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Learning</dt>
          <dd>
            {m.learnedTrades} learned
            {m.pendingLearningReview > 0
              ? ` · ${m.pendingLearningReview} queued`
              : m.automation.autoLearnEnabled
                ? " · auto-ingest on"
                : ""}
          </dd>
        </div>
      </dl>
    </section>
  );
}
