"use client";

import type { PermissionPromptRequest } from "@/lib/agent-os/types";
import { AGENT_OS_SAFETY_NOTICE } from "@/lib/agent-os/types";

export type PermissionDecision = "approve" | "deny" | "approve_once" | "approve_session";

type Props = {
  request: PermissionPromptRequest;
  open: boolean;
  onDecision: (decision: PermissionDecision) => void;
  busy?: boolean;
};

export default function PermissionPrompt({
  request,
  open,
  onDecision,
  busy = false,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-labelledby="permission-prompt-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
          Permission required
        </p>
        <h2 id="permission-prompt-title" className="mt-1 text-lg font-semibold text-zinc-100">
          {request.title}
        </h2>

        <dl className="mt-4 space-y-3 text-xs text-zinc-400">
          <div>
            <dt className="text-zinc-600">Why</dt>
            <dd className="mt-0.5 text-zinc-300">{request.why}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">Risk</dt>
            <dd className="mt-0.5 text-rose-200/90">{request.risk}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">Expected result</dt>
            <dd className="mt-0.5 text-emerald-200/80">{request.expectedResult}</dd>
          </div>
        </dl>

        <p className="mt-4 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[10px] text-zinc-500">
          {AGENT_OS_SAFETY_NOTICE}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecision("approve")}
            className="rounded-lg bg-emerald-800/80 px-3 py-2 text-xs font-semibold text-zinc-50 hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecision("approve_once")}
            className="rounded-lg border border-emerald-800/60 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50"
          >
            Approve once
          </button>
          {request.sessionSafe && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision("approve_session")}
              className="rounded-lg border border-cyan-800/60 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-950/40 disabled:opacity-50"
            >
              Approve for session
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecision("deny")}
            className="rounded-lg border border-rose-800/60 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
