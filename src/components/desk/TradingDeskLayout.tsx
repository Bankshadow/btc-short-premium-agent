"use client";

import type { ReactNode } from "react";
import AgentActivityFeed from "./AgentActivityFeed";
import AgentRoster from "./AgentRoster";
import DeskTopBar from "./DeskTopBar";
import MarketTapeBar from "./MarketTapeBar";
import type { TradingDeskOutput } from "@/lib/agents/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AgentPipelineStatus } from "@/hooks/useAgentPipeline";
import type { DeskAgentId } from "@/lib/desk/agent-roster";

interface TradingDeskLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  data: AnalyzeApiResponse | null;
  desk: TradingDeskOutput | null;
  loading: boolean;
  usingFallback?: boolean;
  lastAnalyzedAt: string | null;
  secondsUntilRefresh: number;
  autoRefreshEnabled: boolean;
  refreshIntervalMs: number;
  onRefreshIntervalChange: (ms: number) => void;
  onToggleAutoRefresh: () => void;
  onRefreshNow: () => void;
  statusById: (id: DeskAgentId) => AgentPipelineStatus;
  activeIndex: number;
  pipelineRunning: boolean;
  profileLabel?: string;
  environmentModeLabel?: string;
}

export default function TradingDeskLayout({
  children,
  sidebar,
  data,
  desk,
  loading,
  usingFallback,
  lastAnalyzedAt,
  secondsUntilRefresh,
  autoRefreshEnabled,
  refreshIntervalMs,
  onRefreshIntervalChange,
  onToggleAutoRefresh,
  onRefreshNow,
  statusById,
  activeIndex,
  pipelineRunning,
  profileLabel,
  environmentModeLabel,
}: TradingDeskLayoutProps) {
  const deskLive = Boolean(desk && !loading);

  return (
    <div className="desk-root flex min-h-[calc(100vh-2rem)] flex-col gap-0">
      <DeskTopBar
        deskLive={deskLive}
        loading={loading}
        lastAnalyzedAt={lastAnalyzedAt}
        secondsUntilRefresh={secondsUntilRefresh}
        autoRefreshEnabled={autoRefreshEnabled}
        refreshIntervalMs={refreshIntervalMs}
        onRefreshIntervalChange={onRefreshIntervalChange}
        onToggleAutoRefresh={onToggleAutoRefresh}
        onRefreshNow={onRefreshNow}
        usingFallback={usingFallback}
        profileLabel={profileLabel}
        environmentModeLabel={environmentModeLabel}
      />

      <MarketTapeBar data={data} />

      <div className="grid flex-1 gap-0 lg:grid-cols-[240px_1fr_280px] xl:grid-cols-[260px_1fr_300px]">
        <AgentRoster
          desk={desk}
          statusById={statusById}
          pipelineRunning={pipelineRunning}
        />

        <main className="flex min-w-0 flex-col gap-3 border-x border-zinc-800/60 bg-zinc-950/40 p-3 sm:p-4">
          <AgentActivityFeed
            statusById={statusById}
            activeIndex={activeIndex}
            visible={loading}
          />
          {children}
        </main>

        <div className="flex flex-col gap-3 border-l border-zinc-800/60 bg-zinc-950/20 p-3">
          {sidebar}
        </div>
      </div>
    </div>
  );
}
