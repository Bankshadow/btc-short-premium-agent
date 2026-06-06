"use client";

import Link from "next/link";
import type { AdvisoryStrategySignal } from "@/lib/strategy-signals/types";
import { STRATEGY_SIGNAL_SAFETY_NOTICE } from "@/lib/strategy-signals/types";

function signalClass(signal: AdvisoryStrategySignal["signal"]): string {
  if (signal === "LONG") return "text-emerald-300 bg-emerald-950/40 border-emerald-800/50";
  if (signal === "SHORT") return "text-rose-300 bg-rose-950/40 border-rose-800/50";
  return "text-zinc-400 bg-zinc-900/60 border-zinc-700/50";
}

function confidenceClass(confidence: AdvisoryStrategySignal["confidence"]): string {
  const map = {
    HIGH: "text-emerald-400",
    MEDIUM: "text-amber-400",
    LOW: "text-zinc-500",
  };
  return map[confidence];
}

function SignalCard({ signal }: { signal: AdvisoryStrategySignal }) {
  return (
    <article className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-zinc-200">{signal.strategyName}</h3>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${signalClass(signal.signal)}`}
        >
          {signal.signal}
        </span>
        <span className={`text-[10px] font-semibold uppercase ${confidenceClass(signal.confidence)}`}>
          {signal.confidence}
        </span>
        <span className="text-[10px] text-zinc-600">{signal.importStatus}</span>
      </div>

      <dl className="mt-3 grid gap-2 text-[11px] text-zinc-400">
        <div>
          <dt className="text-zinc-600">Regime fit</dt>
          <dd className="mt-0.5">{signal.regimeFit.join(" · ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Reasons</dt>
          <dd className="mt-0.5">
            <ul className="list-disc space-y-0.5 pl-4">
              {signal.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Risks</dt>
          <dd className="mt-0.5">
            <ul className="list-disc space-y-0.5 pl-4">
              {signal.risks.slice(0, 3).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Invalidation</dt>
          <dd className="mt-0.5 text-amber-200/80">{signal.invalidationCondition}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Fed to agents</dt>
          <dd className="mt-0.5 text-zinc-500">{signal.fedTo.join(", ")}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function StrategySignalPanel({
  signals = [],
  notice,
}: {
  signals?: AdvisoryStrategySignal[];
  notice?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/90">
        {notice ?? STRATEGY_SIGNAL_SAFETY_NOTICE}
      </p>

      {signals.length === 0 ? (
        <div className="space-y-2 text-xs text-zinc-500">
          <p>No approved quant strategy signals are active for this cycle.</p>
          <p>
            Promote imports to{" "}
            <span className="text-violet-300">READY_FOR_BACKTEST</span> or{" "}
            <span className="text-cyan-300">READY_FOR_PAPER</span> in{" "}
            <Link href="/strategy-garage" className="text-teal-400 hover:underline">
              Strategy Garage
            </Link>
            {" · "}
            <Link href="/strategy-lab/imports" className="text-teal-400 hover:underline">
              Strategy Lab → Imports
            </Link>{" "}
            or evaluate in{" "}
            <Link href="/strategy-lab/shadow" className="text-teal-400 hover:underline">
              Shadow Mode
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((s) => (
            <SignalCard key={s.sourceId} signal={s} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-zinc-600">
        Committee uses these as one input — Risk Manager veto remains the final gate. No auto-execute,
        no live enable.
      </p>
    </div>
  );
}
