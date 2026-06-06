"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ContinuousImprovementStatus,
  ImprovementProposal,
} from "@/lib/continuous-improvement-loop/types";
import { CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE } from "@/lib/continuous-improvement-loop/types";
import { ISSUE_TYPE_LABELS } from "@/lib/continuous-improvement-loop/config";

function statusColor(status: ImprovementProposal["status"]): string {
  if (status === "VERIFIED") return "text-emerald-300";
  if (status === "APPROVED" || status === "IMPLEMENTED") return "text-cyan-300";
  if (status === "PROPOSED") return "text-amber-300";
  if (status === "REJECTED" || status === "VERIFY_FAILED") return "text-rose-300";
  return "text-zinc-400";
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function ContinuousImprovementPanel() {
  const [status, setStatus] = useState<ContinuousImprovementStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/continuous-improvement/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Status failed");
      setStatus(data.status as ContinuousImprovementStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runDetect = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/continuous-improvement/detect", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Detect failed");
      setMessage(`Detected ${data.detected} issue(s) · ${data.proposals?.length ?? 0} proposal(s).`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detect failed");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const action = useCallback(
    async (proposalId: string, route: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/continuous-improvement/${encodeURIComponent(proposalId)}/${route}`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? `${route} failed`);
        setMessage(`${route} complete · ${data.proposal?.status ?? ""}`);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : `${route} failed`);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const proposals = status?.recent ?? [];

  return (
    <div className="space-y-3 text-xs text-zinc-400">
      <p className="text-[10px] text-zinc-600">{CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runDetect()}
          className="rounded border border-violet-700/50 bg-violet-950/40 px-3 py-1.5 text-violet-200 hover:bg-violet-900/40 disabled:opacity-50"
        >
          {busy ? "Scanning…" : "Detect issues"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border border-zinc-700/50 px-3 py-1.5 text-zinc-300 hover:bg-zinc-900/40 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {status && (
        <dl className="grid gap-2 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-600">Proposals</dt>
            <dd className="font-mono text-zinc-200">{status.proposalCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">Awaiting approval</dt>
            <dd className="font-mono text-amber-300">{status.pendingApproval}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">In flight</dt>
            <dd className="font-mono text-cyan-300">{status.awaitingVerification}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">Verified</dt>
            <dd className="font-mono text-emerald-300">{status.verified}</dd>
          </div>
        </dl>
      )}

      {message && (
        <p className="rounded border border-emerald-900/40 bg-emerald-950/20 px-2 py-1 text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded border border-rose-900/40 bg-rose-950/20 px-2 py-1 text-rose-200">
          {error}
        </p>
      )}

      <ol className="space-y-2">
        {proposals.length === 0 ? (
          <li className="text-zinc-600">No improvement proposals yet — run Detect issues.</li>
        ) : (
          proposals.map((p) => (
            <li
              key={p.proposalId}
              className="rounded border border-zinc-800/80 bg-zinc-950/50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-200">{p.title}</span>
                <span className="rounded border border-zinc-700/60 px-1.5 py-0.5 text-[10px]">
                  {ISSUE_TYPE_LABELS[p.issueType]}
                </span>
                <span className={`text-[10px] ${statusColor(p.status)}`}>{p.status}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">{p.problem}</p>
              {p.committeeReview && (
                <p className="mt-1 text-[10px] text-violet-300/80">
                  Committee: {p.committeeReview.summary}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.status === "PROPOSED" && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void action(p.proposalId, "approve")}
                      className="rounded border border-emerald-800/50 px-2 py-0.5 text-emerald-300 hover:bg-emerald-950/30"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void action(p.proposalId, "reject")}
                      className="rounded border border-rose-800/50 px-2 py-0.5 text-rose-300 hover:bg-rose-950/30"
                    >
                      Reject
                    </button>
                  </>
                )}
                {p.status === "APPROVED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void action(p.proposalId, "mark-implemented")}
                    className="rounded border border-cyan-800/50 px-2 py-0.5 text-cyan-300 hover:bg-cyan-950/30"
                  >
                    Mark Cursor done
                  </button>
                )}
                {p.status === "IMPLEMENTED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void action(p.proposalId, "verify")}
                    className="rounded border border-indigo-800/50 px-2 py-0.5 text-indigo-300 hover:bg-indigo-950/30"
                  >
                    Verify after deploy
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyText(p.cursorPrompt)}
                  className="rounded border border-zinc-700/50 px-2 py-0.5 text-zinc-300 hover:bg-zinc-900/40"
                >
                  Copy Cursor prompt
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expandedId === p.proposalId ? null : p.proposalId)
                  }
                  className="rounded border border-zinc-700/50 px-2 py-0.5 text-zinc-400 hover:bg-zinc-900/40"
                >
                  {expandedId === p.proposalId ? "Hide prompt" : "View prompt"}
                </button>
              </div>

              {p.verificationSummary && (
                <p className="mt-2 text-[10px] text-zinc-500">
                  Verify: {p.verificationSummary}
                </p>
              )}

              {expandedId === p.proposalId && (
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-500">
                  {p.cursorPrompt}
                </pre>
              )}
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
