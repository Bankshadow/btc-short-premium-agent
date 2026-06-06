"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import { summarizeWhatAiDid, formatRiskBlocker } from "@/lib/ux/operator-copy";

type Panel = { id: string; title: string; summary?: string; children: ReactNode };

function ExpandablePanel({ panel }: { panel: Panel }) {
  return (
    <details className="group rounded-xl border border-zinc-800/80 bg-zinc-950/40">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-zinc-400 [&::-webkit-details-marker]:hidden">
        {panel.title}
        {panel.summary && (
          <span className="ml-2 font-normal text-zinc-600">— {panel.summary}</span>
        )}
        <span className="ml-2 opacity-50 group-open:hidden">▸</span>
        <span className="ml-2 hidden opacity-50 group-open:inline">▾</span>
      </summary>
      <div className="border-t border-zinc-800 px-4 pb-4 pt-3">{panel.children}</div>
    </details>
  );
}

type Props = {
  data: AnalyzeApiResponse | null;
  autopilot: AutopilotRunResult | null;
  running: boolean;
};

export default function CockpitExpandableDetails({ data, autopilot, running }: Props) {
  const panels: Panel[] = [];

  if (autopilot && autopilot.blockers.length > 0) {
    panels.push({
      id: "risk-details",
      title: "View risk details",
      summary: `${autopilot.blockers.length} blocker(s)`,
      children: (
        <div className="space-y-2 text-xs text-rose-200/90">
          <ul className="list-disc space-y-1 pl-4">
            {autopilot.blockers.map((b) => (
              <li key={b}>{formatRiskBlocker(b)}</li>
            ))}
          </ul>
          <Link href="/command-center" className="text-rose-300 hover:underline">
            Open command center →
          </Link>
        </div>
      ),
    });
  }

  if (data) {
    panels.push({
      id: "raw-data",
      title: "View raw data",
      summary: "Market snapshot & data trust",
      children: (
        <div className="space-y-2 text-xs text-zinc-400">
          <p>
            BTC ${data.step1_marketSnapshot.spotPrice.toLocaleString()} · IV/HV{" "}
            {data.step1_marketSnapshot.ivHvRatio?.toFixed(2) ?? "—"}
          </p>
          <p>
            Data trust: {data.dataTrust?.grade ?? "—"}
            {data.dataTrust?.criticalIssues?.[0]
              ? ` · ${data.dataTrust.criticalIssues[0]}`
              : ""}
          </p>
          {data.optionCandidates?.[0] && (
            <p>
              Candidate: {data.optionCandidates[0].symbol} · mark $
              {data.optionCandidates[0].markPrice}
            </p>
          )}
        </div>
      ),
    });
  }

  if (autopilot?.modulesRun && autopilot.modulesRun.length > 0) {
    const lines = summarizeWhatAiDid(autopilot.modulesRun);
    panels.push({
      id: "what-ai-did",
      title: "What the AI did",
      summary: `${lines.length} step(s) on last cycle`,
      children: (
        <ul className="space-y-1 text-xs text-zinc-400">
          {lines.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      ),
    });
  }

  if (running) {
    panels.push({
      id: "running",
      title: "Desk cycle in progress",
      summary: "Please wait",
      children: (
        <p className="text-xs text-cyan-300">
          Agents are analyzing market, risk, and strategy conditions in the background.
        </p>
      ),
    });
  }

  if (panels.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
        Advanced details
      </p>
      {panels.map((p) => (
        <ExpandablePanel key={p.id} panel={p} />
      ))}
    </div>
  );
}
