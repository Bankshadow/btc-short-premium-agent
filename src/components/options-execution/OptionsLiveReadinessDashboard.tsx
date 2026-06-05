"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OpsShell, { OpsKpi } from "@/components/ops/OpsShell";
import { buildOptionsLiveReadinessReport } from "@/lib/options-execution/options-readiness";
import type { OptionsLiveReadinessReport } from "@/lib/options-execution/options-readiness";
import { loadOptionsPreviewJournal } from "@/lib/options-execution/preview-journal-store";

export default function OptionsLiveReadinessDashboard() {
  const [report, setReport] = useState<OptionsLiveReadinessReport | null>(null);
  const [journalCount, setJournalCount] = useState(0);

  useEffect(() => {
    setReport(buildOptionsLiveReadinessReport());
    setJournalCount(loadOptionsPreviewJournal().length);
  }, []);

  return (
    <OpsShell
      badge="MVP 27 · Preview layer"
      title="BTC Options Live Readiness"
      subtitle="Testnet preparation and preview validation — real BTC options live execution is not implemented."
      accent="violet"
      iconLetters="OP"
      activePath="/options-live-readiness"
      nav={[
        { href: "/", label: "← Desk" },
        { href: "/live-readiness", label: "Perp ready" },
        { href: "/governance", label: "Governance", primary: true },
      ]}
    >
      <p className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-4 py-2 text-xs text-violet-200/80">
        Preview only — real BTC options live disabled. Testnet execution:{" "}
        <Link href="/options-testnet" className="text-cyan-400 hover:underline">
          /options-testnet
        </Link>
      </p>

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <OpsKpi
              label="Overall"
              value={report.overallStatus}
              hint="Options-specific gates"
            />
            <OpsKpi
              label="Testnet sim"
              value={report.executionStatus.testnetEnabled ? "ON" : "OFF"}
              hint="OPTIONS_TESTNET_ENABLED"
            />
            <OpsKpi
              label="Preview journal"
              value={String(journalCount)}
              hint="Stored previews"
            />
          </div>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Readiness checks</h2>
            <ul className="mt-3 space-y-2 text-xs">
              {report.checks.map((c) => (
                <li
                  key={c.label}
                  className="flex flex-wrap gap-2 rounded border border-zinc-800 px-3 py-2"
                >
                  <span
                    className={
                      c.status === "PASS"
                        ? "text-emerald-400"
                        : c.status === "WARNING"
                          ? "text-amber-400"
                          : "text-rose-400"
                    }
                  >
                    {c.status}
                  </span>
                  <span className="font-medium text-zinc-200">{c.label}</span>
                  <span className="text-zinc-500">{c.message}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="desk-panel px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Recommended actions</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-400">
              {report.recommendedActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </section>

          <Link href="/" className="text-xs text-violet-400 hover:underline">
            Open desk · use Options Preview panel on TRADE tickets →
          </Link>
        </>
      )}
    </OpsShell>
  );
}
