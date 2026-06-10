"use client";



import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import GoalErrorBanner from "./GoalErrorBanner";

import GoalShell from "./GoalShell";

import MicroLiveReadinessChecklist from "@/components/micro-live-readiness/MicroLiveReadinessChecklist";

import StrategyHealthReportPanel from "@/components/integrated-strategy-health/StrategyHealthReportPanel";

import AgentScoreboardV2Panel from "@/components/integrated-strategy-agent-health/AgentScoreboardV2Panel";

import EvidenceQualityPanel from "@/components/evidence-quality/EvidenceQualityPanel";

import IntegratedQualityCalibrationPanel from "@/components/integrated-quality-calibration/IntegratedQualityCalibrationPanel";

import LearningQueuePanel from "@/components/learning-queue/LearningQueuePanel";

import { IntegratedRiskBudgetPanel } from "@/components/integrated-risk-budget/IntegratedRiskBudgetPanel";

import {
  MissionControllerRiskBudgetPanel,
} from "@/components/mission-controller-risk-budget/MissionControllerRiskBudgetPanel";

import { AlwaysOnOperatorLayerPanel } from "@/components/always-on-operator-layer/AlwaysOnOperatorLayerPanel";

import {
  MicroLiveReadinessReviewPanel,
} from "@/components/micro-live-readiness-review/MicroLiveReadinessReviewPanel";

import { MissionModeLabels } from "@/components/mission-mode-labels/MissionModeLabels";
import EngineActivationStatusPanel from "@/components/testnet-engine-activation/EngineActivationStatusPanel";

import { IntegratedDailySelfReviewPanel } from "@/components/integrated-daily-self-review/IntegratedDailySelfReviewPanel";

import { useMissionSnapshot } from "./use-mission-snapshot";

import { useAnalysisState } from "@/hooks/useAnalysisState";



function usd(n: number): string {

  const sign = n < 0 ? "-" : "";

  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

}



function ReportSection({

  title,

  summary,

  children,

}: {

  title: string;

  summary?: string;

  children: React.ReactNode;

}) {

  return (

    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5">

      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">

        {title}

      </h2>

      {summary && <p className="mt-2 text-sm text-zinc-400">{summary}</p>}

      <div className="mt-3">{children}</div>

    </section>

  );

}



export default function ReportsView() {

  const { snapshot: m, busy, error, degraded, warnings, refresh } =

    useMissionSnapshot();

  const analysis = useAnalysisState(15000);

  const [digest, setDigest] = useState<string | null>(null);



  const loadDigest = useCallback(async () => {

    try {

      const res = await fetch("/api/mission/digest", { cache: "no-store" });

      const json = await res.json();

      if (res.ok && json.ok) setDigest(json.digest as string);

    } catch {

      /* optional */

    }

  }, []);



  useEffect(() => {

    void loadDigest();

  }, [loadDigest, m.lastUpdatedAt]);



  const dailySummary =

    m.integratedDailySelfReview?.review?.oneLineSummary ??

    (m.closedTrades > 0

      ? `${m.closedTrades} closed · ${m.wins}W/${m.losses}L · net ${usd(m.netPnl)}`

      : "No trades yet — run Start AI on Dashboard.");



  const incidentOpen = analysis.state?.context?.incidentState.openCount ?? 0;



  return (

    <GoalShell

      title="Reports"

      subtitle="Daily summary, evidence, strategy health, learning, and readiness."

      activePath="/reports"

      missionSnapshot={m}

      actions={

        <button

          type="button"

          disabled={busy}

          onClick={() => {

            void refresh(true);

            void analysis.refresh(true);

            void loadDigest();

          }}

          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900/60 disabled:opacity-50"

        >

          {busy ? "Refreshing..." : "Refresh"}

        </button>

      }

    >

      <GoalErrorBanner

        error={error ?? analysis.error}

        degraded={degraded}

        warnings={warnings}

        snapshot={m}

      />



      <ReportSection title="Daily summary" summary={dailySummary}>

        <IntegratedDailySelfReviewPanel dailyReview={m.integratedDailySelfReview} />

        {digest && (

          <pre className="mt-3 whitespace-pre-wrap font-mono text-[11px] text-zinc-500">

            {digest.slice(0, 1200)}

            {digest.length > 1200 ? "…" : ""}

          </pre>

        )}

      </ReportSection>



      <ReportSection

        title="Evidence progress"

        summary={`${m.evidenceProgress.completedTrades} / ${m.evidenceProgress.requiredTrades} valid trades · ${m.evidenceQuality.validEvidenceCount} evidence-quality valid · ${m.evidenceProgress.nextExpectedAction}`}

      >

        <EvidenceQualityPanel quality={m.evidenceQuality} compact />

        <ul className="mt-3 space-y-1 text-xs text-zinc-400">

          <li>Evidence ready: {m.evidenceProgress.evidenceSetReady ? "Yes" : "No"}</li>

          <li>Realized PnL (evidence): {usd(m.evidenceProgress.realizedPnl)}</li>

          {m.evidenceProgress.currentBlocker && (

            <li className="text-amber-300">{m.evidenceProgress.currentBlocker}</li>

          )}

        </ul>

      </ReportSection>



      <ReportSection

        title="Trade quality & calibration"

        summary={

          m.integratedQualityCalibration?.strategyImprovementSuggestion ??

          m.integratedTradeQuality?.summary.headline ??

          "Measure decision quality and AI confidence accuracy from completed trades."

        }

      >

        <IntegratedQualityCalibrationPanel

          qualityCalibration={m.integratedQualityCalibration}

          tradeQuality={m.integratedTradeQuality}

          confidenceCalibration={m.integratedConfidenceCalibration}

        />

      </ReportSection>



      <ReportSection

        title="Strategy health"

        summary={

          m.integratedStrategyHealth?.primaryReport?.recommendation ??

          m.strategyHealth?.recommendation

        }

      >

        <StrategyHealthReportPanel
          health={m.integratedStrategyHealth}
          agentHealth={m.integratedStrategyAgentHealth}
        />

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Agent scoreboard v2
          </p>
          <AgentScoreboardV2Panel
            scoreboard={m.integratedStrategyAgentHealth?.agentScoreboardV2}
          />
        </div>

      </ReportSection>



      <ReportSection

        title="Learning"

        summary={`${m.learnedTrades} learned · ${m.pendingLearningReview} pending review`}

      >

        <LearningQueuePanel progress={m.learningProgress} showTable />

      </ReportSection>



      <ReportSection

        title="Risk/readiness"

        summary={
          m.microLiveReadinessReview.readinessStatus === "READY_FOR_REVIEW"
            ? "MVP 94 readiness review passed — schedule human review"
            : m.microLiveReadinessReview.readinessStatus === "BLOCKED"
              ? "Readiness BLOCKED — live safety violation"
              : m.microLiveReadinessReview.topBlocker
                ? m.microLiveReadinessReview.topBlocker
                : incidentOpen > 0
                  ? `${incidentOpen} open incident(s) · review readiness checklist`
                  : "Readiness gaps remain — advisory only"
        }
      >
        <div className="mb-4">
          <MissionModeLabels snapshot={m} />
        </div>

        <EngineActivationStatusPanel />

        <div className="mt-4 border-t border-zinc-800/80 pt-4">
          <MicroLiveReadinessReviewPanel review={m.microLiveReadinessReview} />
        </div>

        <details className="mt-4 border-t border-zinc-800/80 pt-4">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Legacy readiness checklist (MVP 75)
          </summary>
          <div className="mt-3">
            <MicroLiveReadinessChecklist readiness={m.microLiveReadiness} />
          </div>
        </details>

        <div className="mt-4 border-t border-zinc-800/80 pt-4">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Always-on operator layer (MVP 93)
          </h3>
          <AlwaysOnOperatorLayerPanel snapshot={m.alwaysOnOperatorLayer} />
        </div>

        <div className="mt-4 border-t border-zinc-800/80 pt-4">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Mission controller & risk budget (MVP 92)
          </h3>
          <MissionControllerRiskBudgetPanel snapshot={m.missionControllerRiskBudget} />
          <details className="mt-4">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Risk budget optimizer detail (MVP 78)
            </summary>
            <div className="mt-3">
              <IntegratedRiskBudgetPanel riskBudget={m.integratedRiskBudget} />
            </div>
          </details>
        </div>

        {incidentOpen > 0 && (

          <Link

            href="/incidents"

            className="mt-3 inline-block text-xs text-emerald-300 hover:underline"

          >

            Open incidents →

          </Link>

        )}

      </ReportSection>

    </GoalShell>

  );

}


