"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { useWorkspaceFetchHeaders } from "@/components/platform/PlatformWorkspaceHeaders";
import type {
  MVPProposal,
  ProjectStrategistReport,
  ProjectStrategistStatusSnapshot,
  SkillCard,
  StrategistExternalSource,
} from "@/lib/project-strategist";

type StrategistStatusResponse = {
  ok: boolean;
  snapshot?: ProjectStrategistStatusSnapshot;
  safetyNotice?: string;
  error?: string;
};

function healthTone(status: string): string {
  if (status === "GREEN") return "text-emerald-300";
  if (status === "YELLOW") return "text-amber-300";
  if (status === "RED") return "text-rose-300";
  return "text-zinc-300";
}

function statusTone(status: string): string {
  if (status === "ACTIVE" || status === "IMPLEMENTED") return "text-emerald-300";
  if (status === "REJECTED") return "text-rose-300";
  if (status === "ACCEPTED") return "text-cyan-300";
  return "text-amber-300";
}

export default function ProjectStrategistDashboard() {
  const workspaceHeaders = useWorkspaceFetchHeaders();
  const [snapshot, setSnapshot] = useState<ProjectStrategistStatusSnapshot | null>(
    null,
  );
  const [safetyNotice, setSafetyNotice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestUserGoal, setLatestUserGoal] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/project-strategist/status", {
        headers: workspaceHeaders,
      });
      const data = (await res.json()) as StrategistStatusResponse;
      if (!data.ok || !data.snapshot) {
        throw new Error(data.error ?? "Failed to load strategist status");
      }
      setSnapshot(data.snapshot);
      setSafetyNotice(data.safetyNotice ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    }
  }, [workspaceHeaders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const latestReport = snapshot?.latestReport ?? null;
  const mvpProposals = snapshot?.state.mvpProposals ?? [];
  const skills = snapshot?.state.skills ?? [];
  const sources = snapshot?.state.sources ?? [];

  const runStrategist = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/project-strategist/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({
          trigger: "manual",
          latestUserGoal: latestUserGoal.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Run failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  const addSourceLink = async () => {
    if (!sourceUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/project-strategist/source/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim(),
          title: sourceTitle.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Add source failed");
      }
      setSourceUrl("");
      setSourceTitle("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add source failed");
    } finally {
      setBusy(false);
    }
  };

  const pasteSourceContent = async () => {
    if (!pasteContent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/project-strategist/source/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({
          sourceUrl: sourceUrl.trim() || null,
          title: sourceTitle.trim() || undefined,
          sourceContent: pasteContent.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Paste source failed");
      }
      setPasteContent("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paste source failed");
    } finally {
      setBusy(false);
    }
  };

  const approveSkill = async (skillId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/project-strategist/skill/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({ skillId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Approve failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const rejectSkill = async (skillId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/project-strategist/skill/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        body: JSON.stringify({ skillId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Reject failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  const updateMvp = async (mvpId: string, mode: "accept" | "implemented") => {
    setBusy(true);
    try {
      const res = await fetch(
        mode === "accept"
          ? "/api/project-strategist/mvp/accept"
          : "/api/project-strategist/mvp/implemented",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...workspaceHeaders },
          body: JSON.stringify({ mvpId }),
        },
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "MVP update failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "MVP update failed");
    } finally {
      setBusy(false);
    }
  };

  const copyCursorPrompt = async () => {
    const prompt = latestReport?.cursorPrompt;
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      setError("Unable to copy cursor prompt.");
    }
  };

  const proposedSkills = useMemo(
    () => skills.filter((s) => s.status === "PROPOSED"),
    [skills],
  );

  return (
    <OpsShell
      badge="MVP · Project Strategist"
      title="AI Project Strategist"
      subtitle="Daily project diagnosis, one-day MVP recommendation, skill updates, and Cursor-ready implementation prompts."
      accent="indigo"
      iconLetters="PS"
      activePath="/project-strategist"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/automation-control", label: "Automation" },
        { href: "/testnet-monitor", label: "TN Monitor" },
      ]}
      actions={
        <button
          type="button"
          onClick={() => void runStrategist()}
          disabled={busy}
          className="rounded-lg bg-indigo-700/90 px-4 py-2 text-xs font-semibold text-zinc-100 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run Strategist"}
        </button>
      }
    >
      <p className="rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-4 py-2 text-xs text-indigo-200/90">
        {safetyNotice || "Strategist safety guards active."}
      </p>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsKpi
          label="Project health"
          value={latestReport?.projectHealthStatus ?? "—"}
          hint={latestReport?.generatedAt ? new Date(latestReport.generatedAt).toLocaleString() : "No report yet"}
        />
        <OpsKpi
          label="Top problems"
          value={String(latestReport?.topProblems.length ?? 0)}
          hint="Critical diagnosis findings"
        />
        <OpsKpi
          label="Skill proposals"
          value={String(proposedSkills.length)}
          hint="Awaiting human approval"
        />
        <OpsKpi
          label="MVP proposals"
          value={String(mvpProposals.length)}
          hint="Accepted / rejected / implemented tracked"
        />
      </div>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Today&apos;s Diagnosis</h2>
        {latestReport ? (
          <div className="mt-3 space-y-3 text-xs text-zinc-300">
            <p className={healthTone(latestReport.projectHealthStatus)}>
              Health: {latestReport.projectHealthStatus}
            </p>
            <p>Product: {latestReport.productDiagnosis}</p>
            <p>Technical: {latestReport.technicalDiagnosis}</p>
            <p>Trading readiness: {latestReport.tradingReadinessDiagnosis}</p>
            <p>UX: {latestReport.uxDiagnosis}</p>
            <p>Automation: {latestReport.automationDiagnosis}</p>
            <div>
              <p className="mb-1 font-semibold text-zinc-200">Top Problems</p>
              <ul className="list-disc space-y-1 pl-5 text-zinc-400">
                {latestReport.topProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-semibold text-zinc-200">Hidden Risks</p>
              <ul className="list-disc space-y-1 pl-5 text-zinc-400">
                {latestReport.hiddenRisks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            No strategist report yet. Click <span className="text-zinc-300">Run Strategist</span>.
          </p>
        )}
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">Recommended MVP</h2>
        {latestReport ? (
          <div className="mt-3 space-y-2 text-xs text-zinc-300">
            <p className="text-sm font-semibold text-indigo-300">
              {latestReport.recommendedMVP.title}
            </p>
            <p>Problem: {latestReport.recommendedMVP.problem}</p>
            <p>Why now: {latestReport.recommendedMVP.whyNow}</p>
            <p>Impact: {latestReport.recommendedMVP.expectedImpact}</p>
            <p>Complexity: {latestReport.recommendedMVP.estimatedComplexity}</p>
            <div>
              <p className="font-semibold text-zinc-200">One-Day Plan</p>
              <ul className="list-disc space-y-1 pl-5 text-zinc-400">
                {latestReport.oneDayImplementationPlan.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void updateMvp(latestReport.recommendedMVP.mvpId, "accept")}
                disabled={busy}
                className="rounded border border-cyan-800 bg-cyan-950/30 px-2 py-1 text-[11px] text-cyan-200 disabled:opacity-50"
              >
                Mark MVP Accepted
              </button>
              <button
                type="button"
                onClick={() =>
                  void updateMvp(latestReport.recommendedMVP.mvpId, "implemented")
                }
                disabled={busy}
                className="rounded border border-emerald-800 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200 disabled:opacity-50"
              >
                Mark MVP Implemented
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No recommendation yet.</p>
        )}
      </section>

      <section className="desk-panel px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Cursor Prompt</h2>
          <button
            type="button"
            onClick={() => void copyCursorPrompt()}
            disabled={!latestReport?.cursorPrompt}
            className="rounded border border-indigo-800 bg-indigo-950/30 px-2 py-1 text-[11px] text-indigo-200 disabled:opacity-50"
          >
            Copy Cursor Prompt
          </button>
        </div>
        <pre className="mt-3 max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">
          {latestReport?.cursorPrompt ?? "No prompt yet."}
        </pre>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="desk-panel px-4 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">External Sources</h2>
          <div className="mt-3 space-y-2">
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://x.com/... or docs URL"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            />
            <input
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="Optional title"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void addSourceLink()}
                disabled={busy || !sourceUrl.trim()}
                className="rounded border border-indigo-800 bg-indigo-950/30 px-2 py-1 text-[11px] text-indigo-200 disabled:opacity-50"
              >
                Add Source Link
              </button>
            </div>
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              rows={5}
              placeholder="Paste tweet/thread/article content when fetch fails."
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            />
            <button
              type="button"
              onClick={() => void pasteSourceContent()}
              disabled={busy || !pasteContent.trim()}
              className="rounded border border-cyan-800 bg-cyan-950/30 px-2 py-1 text-[11px] text-cyan-200 disabled:opacity-50"
            >
              Paste Source Content
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {sources.slice(0, 12).map((s) => (
              <SourceRow key={s.sourceId} source={s} />
            ))}
          </div>
        </div>

        <div className="desk-panel px-4 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Skill Updates</h2>
          <div className="mt-3 space-y-2">
            {skills.slice(0, 20).map((skill) => (
              <SkillRow
                key={skill.skillId}
                skill={skill}
                busy={busy}
                onApprove={approveSkill}
                onReject={rejectSkill}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="desk-panel px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100">
          Previous MVP Proposals
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {mvpProposals.slice(0, 24).map((mvp) => (
            <div key={mvp.mvpId} className="rounded border border-zinc-800 bg-zinc-950/40 p-3">
              <p className="text-xs font-semibold text-zinc-200">{mvp.title}</p>
              <p className={`mt-1 text-[11px] ${statusTone(mvp.status)}`}>
                {mvp.status}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{mvp.problem}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-zinc-600">
        Strategist is analysis-only. For execution readiness use{" "}
        <Link className="text-cyan-400 hover:underline" href="/binance-testnet">
          /binance-testnet
        </Link>{" "}
        and{" "}
        <Link className="text-cyan-400 hover:underline" href="/testnet-monitor">
          /testnet-monitor
        </Link>
        .
      </p>
    </OpsShell>
  );
}

function SourceRow({ source }: { source: StrategistExternalSource }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2 text-[11px] text-zinc-400">
      <p className="font-semibold text-zinc-300">{source.title}</p>
      <p>Status: {source.fetchStatus}</p>
      {source.sourceUrl && (
        <p className="truncate text-zinc-500">{source.sourceUrl}</p>
      )}
      {source.lastError && <p className="text-rose-400">{source.lastError}</p>}
    </div>
  );
}

function SkillRow({
  skill,
  busy,
  onApprove,
  onReject,
}: {
  skill: SkillCard;
  busy: boolean;
  onApprove: (skillId: string) => Promise<void> | void;
  onReject: (skillId: string) => Promise<void> | void;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-3 text-[11px] text-zinc-400">
      <p className="font-semibold text-zinc-200">{skill.title}</p>
      <p className="mt-1 text-zinc-500">{skill.skillType}</p>
      <p className="mt-1">{skill.summary}</p>
      <p className={`mt-1 ${statusTone(skill.status)}`}>{skill.status}</p>
      {skill.status === "PROPOSED" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void onApprove(skill.skillId)}
            disabled={busy}
            className="rounded border border-emerald-800 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200 disabled:opacity-50"
          >
            Approve Skill Update
          </button>
          <button
            type="button"
            onClick={() => void onReject(skill.skillId)}
            disabled={busy}
            className="rounded border border-rose-800 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200 disabled:opacity-50"
          >
            Reject Skill Update
          </button>
        </div>
      )}
    </div>
  );
}
