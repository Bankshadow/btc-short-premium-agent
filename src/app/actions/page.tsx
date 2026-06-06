"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OpsShell from "@/components/ops/OpsShell";
import {
  loadOperatorActionQueue,
  resolveOperatorAction,
} from "@/lib/operator-action-queue/queue-store";
import type { OperatorAction } from "@/lib/operator-action-queue/types";

export default function ActionsPage() {
  const [actions, setActions] = useState<OperatorAction[]>([]);

  useEffect(() => {
    setActions(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
  }, []);

  const dismiss = (id: string) => {
    resolveOperatorAction(id, "DISMISSED");
    setActions(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
  };

  const done = (id: string) => {
    resolveOperatorAction(id, "DONE");
    setActions(loadOperatorActionQueue().filter((a) => a.status === "OPEN"));
  };

  return (
    <OpsShell
      badge="MVP 41 · Actions"
      title="Operator Action Queue"
      subtitle="What the desk needs from you next — generated from learning gaps, risk blockers, and setup."
      accent="indigo"
      iconLetters="AQ"
      activePath="/actions"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/autopilot", label: "Autopilot" },
      ]}
    >
      {actions.length === 0 ? (
        <p className="text-sm text-zinc-500">No open actions — run a desk cycle on the cockpit.</p>
      ) : (
        <ul className="space-y-3">
          {actions.map((a) => (
            <li
              key={a.actionId}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-amber-400">{a.priority}</span>
                <span className="font-semibold text-zinc-100">{a.title}</span>
                <span className="text-zinc-500">{a.type}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{a.description}</p>
              <p className="mt-1 text-xs text-zinc-500">{a.reason}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => done(a.actionId)}
                  className="rounded border border-emerald-800/50 px-2 py-1 text-xs text-emerald-300"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(a.actionId)}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/" className="mt-4 inline-block text-xs text-indigo-400 hover:underline">
        Back to cockpit →
      </Link>
    </OpsShell>
  );
}
