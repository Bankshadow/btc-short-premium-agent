import { getLatestAnalysis } from "@/lib/analysis/analysis-runner";
import { getLatestCollaboration } from "@/lib/collaboration/collaboration-runner";
import type { CommitteeSummary } from "@/lib/collaboration/collaboration-types";
import type { CoreHealthReport } from "@/lib/core/core-health";
import type { UiProjectionData } from "@/lib/core/ui-projection-data";
import { getAllLearningRecords } from "@/lib/learning/learning-store";
import { getEvents } from "@/lib/journal/journal-query";
import { loadPolymarketConfig } from "@/lib/polymarket/config";
import { getPolymarketDashboard } from "@/lib/polymarket/run-cycle";
import type { PolymarketDashboardData } from "@/lib/polymarket/types";
import type { BlockedSweeperRecord, SweeperOpportunity, SweeperPaperTrade } from "@/lib/polymarket/sweeper-types";
import type { CryptoPriceSnapshot } from "@/lib/polymarket/types";
import { getOperatorStatus } from "@/lib/operator/operator-actions";
import type { OperatorStatus } from "@/lib/operator/operator-types";
import type { PortfolioRiskReport } from "@/lib/portfolio-risk/portfolio-risk-types";
import { getLatestRegimeClassification } from "@/lib/regime/regime-retrieval";
import type { RegimeClassification } from "@/lib/regime/regime-types";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import type { ScenarioSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-types";
import { mockFundingRate } from "./mock-funding";
import type {
  TerminalAgentDebate,
  TerminalCommandCenter,
  TerminalConfigPanel,
  TerminalDecisionRow,
  TerminalMarketData,
  TerminalMispricingRow,
  TerminalPaperTradeRow,
  TerminalRiskGuardRow,
  TerminalSweeperRow,
  TerminalSystemHealth,
} from "./terminal-types";

function freshnessSec(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
}

function mapAssetTick(
  snap: CryptoPriceSnapshot | undefined,
  symbol: "BTC" | "ETH",
  regime: RegimeClassification | null,
): TerminalMarketData["btc"] {
  const funding = mockFundingRate(symbol);
  if (!snap) {
    return {
      price: 0,
      fundingRate: funding.rate,
      fundingSimulated: true,
      volatility: 0,
      trend: regime?.regime ?? "UNKNOWN",
      momentum: 0,
      dataFreshnessSec: Infinity,
      quality: "UNKNOWN",
    };
  }
  return {
    price: snap.price,
    fundingRate: funding.rate,
    fundingSimulated: true,
    volatility: snap.volatility,
    trend: regime?.regime ?? "UNKNOWN",
    momentum: snap.momentumScore,
    dataFreshnessSec: freshnessSec(snap.timestamp),
    quality: snap.quality === "FRESH" ? "FRESH" : snap.quality === "STALE" ? "STALE" : "UNKNOWN",
  };
}

export function mapCommandCenter(input: {
  regime: RegimeClassification | null;
  analysis: Awaited<ReturnType<typeof getLatestAnalysis>>;
  operator: OperatorStatus;
  coreHealth: CoreHealthReport;
  polyHealth: PolymarketDashboardData["health"];
}): TerminalCommandCenter {
  const thesis =
    input.analysis.verdict?.reasons?.[0] ??
    input.analysis.scenarioNote ??
    null;
  return {
    btcRegime: input.regime?.regime ?? input.analysis.regime ?? "UNKNOWN",
    ethRegime: input.regime?.regime ?? "UNKNOWN",
    activeThesis: thesis,
    thesisConfidence: input.analysis.verdict?.confidence ?? null,
    riskMode: input.operator.riskMode,
    systemHealthStatus: input.coreHealth.status,
    paperTradingStatus: input.polyHealth.paperTradingEnabled ? "ENABLED" : "DISABLED",
    killSwitchActive: input.operator.killSwitchActive,
    killSwitchReason: input.operator.killSwitchReason,
    engineState: input.operator.engineState,
  };
}

export function mapMarketData(input: {
  btc: CryptoPriceSnapshot | undefined;
  eth: CryptoPriceSnapshot | undefined;
  regime: RegimeClassification | null;
}): TerminalMarketData {
  return {
    btc: mapAssetTick(input.btc, "BTC", input.regime),
    eth: mapAssetTick(input.eth, "ETH", input.regime),
  };
}

export function mapPolymarketMispricing(dashboard: PolymarketDashboardData): TerminalMispricingRow[] {
  const fairById = new Map(dashboard.fairPrices.map((f) => [f.marketId, f]));
  const signalByMarket = new Map(dashboard.signals.map((s) => [s.marketId, s]));

  return dashboard.markets.map((m) => {
    const fair = fairById.get(m.marketId);
    const sig = signalByMarket.get(m.marketId);
    const spread = m.bestAskYes - m.bestBidYes;
    return {
      marketId: m.marketId,
      marketLabel: m.slug || m.question.slice(0, 48),
      fairProbability: fair?.fairProbabilityYes ?? m.yesPrice,
      polymarketPrice: m.yesPrice,
      edge: fair ? fair.fairProbabilityYes - m.yesPrice : sig?.estimatedEdge ?? 0,
      confidence: fair?.confidenceScore ?? sig?.confidence ?? 0,
      liquidity: m.liquidity,
      spread,
      status: sig?.status ?? "NONE",
    };
  });
}

export function mapSweeperRows(input: {
  opportunities: SweeperOpportunity[];
  blocked: BlockedSweeperRecord[];
  paperTrades: SweeperPaperTrade[];
}): TerminalSweeperRow[] {
  const paperByOpp = new Map(input.paperTrades.map((t) => [t.opportunityId, t]));

  const approved: TerminalSweeperRow[] = input.opportunities.map((o) => {
    const paper = paperByOpp.get(o.opportunityId);
    const yesAsk = o.side === "BUNDLE_YES_NO" ? o.suggestedPrice : o.side.includes("YES") ? o.suggestedPrice : o.secondaryPrice ?? null;
    const noAsk = o.secondaryPrice ?? null;
    const totalCost = o.secondaryPrice != null ? o.suggestedPrice + o.secondaryPrice : null;
    return {
      opportunityId: o.opportunityId,
      marketId: o.marketId,
      opportunityType: o.strategy,
      yesAsk,
      noAsk,
      totalCost,
      grossEdge: o.estimatedEdge,
      netEdge: null,
      riskFlags: o.riskFlags,
      signalStatus: "OPEN",
      paperTradeStatus: paper
        ? paper.fillStatus === "PARTIAL"
          ? "PARTIAL"
          : paper.status === "OPEN"
            ? "OPEN"
            : paper.status
        : "NONE",
      createdAt: o.createdAt,
    };
  });

  const blockedRows: TerminalSweeperRow[] = input.blocked.map((b) => ({
    opportunityId: b.opportunityId,
    marketId: b.marketId,
    opportunityType: b.strategy,
    yesAsk: null,
    noAsk: null,
    totalCost: null,
    grossEdge: b.estimatedEdge,
    netEdge: null,
    riskFlags: b.riskFlags,
    signalStatus: "BLOCKED",
    paperTradeStatus: "NONE",
    createdAt: b.createdAt,
  }));

  return [...approved, ...blockedRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mapAgentDebate(input: {
  collaboration: CommitteeSummary | null;
  swarm: ScenarioSwarmReport | null;
  analysis: Awaited<ReturnType<typeof getLatestAnalysis>>;
  regime: RegimeClassification | null;
}): TerminalAgentDebate {
  const bull = input.swarm?.agentVotes.find((v) => v.role === "Bull Case Agent");
  const bear = input.swarm?.agentVotes.find((v) => v.role === "Bear Case Agent");
  const quant = input.collaboration?.proposals.find((p) => p.agentId === "market-analyst");
  const riskCritiques =
    input.collaboration?.critiques.filter((c) => c.role === "Risk Manager") ?? [];

  const disagreements = [
    ...(input.collaboration?.dissentingViews ?? []),
    ...(input.swarm?.agentVotes
      .filter((v) => v.vote === "BEARISH" || v.vote === "RISK_OFF")
      .map((v) => `${v.role}: ${v.reasoning}`) ?? []),
  ];

  const committeeText = input.collaboration
    ? `${input.collaboration.finalRecommendation} — ${input.collaboration.riskNotes.slice(0, 2).join(" ")}`
    : input.swarm?.likelyScenario ?? null;

  return {
    bullThesis: bull ? `${bull.vote}: ${bull.reasoning}` : input.swarm?.upsideScenario ?? null,
    bearThesis: bear ? `${bear.vote}: ${bear.reasoning}` : input.swarm?.downsideScenario ?? null,
    quantView: quant?.proposal ?? (input.regime ? `Regime ${input.regime.regime} (${(input.regime.confidence * 100).toFixed(0)}%)` : null),
    riskManagerView:
      riskCritiques.map((c) => c.critique).join(" ") ||
      input.analysis.noTradeBlockReason ||
      null,
    committeeView: committeeText,
    finalRecommendation: input.collaboration?.finalRecommendation ?? null,
    unresolvedDisagreements: [...new Set(disagreements)].slice(0, 8),
    advisoryOnly: true,
  };
}

export function mapRiskGuard(input: {
  poly: PolymarketDashboardData;
  portfolio: PortfolioRiskReport;
  operator: OperatorStatus;
  events: Awaited<ReturnType<typeof getEvents>>;
}): TerminalRiskGuardRow[] {
  const rows: TerminalRiskGuardRow[] = [];

  for (const b of input.poly.blockedSignals) {
    rows.push({
      id: b.signalId,
      source: "POLYMARKET",
      blockedSignal: b.marketId,
      triggeredRules: b.ruleCodes,
      severity: "BLOCK",
      reason: b.reason,
      recommendedAction: "Review mispricing signal — paper only.",
      createdAt: b.createdAt,
    });
  }

  for (const b of input.poly.blockedSweeperOpportunities ?? []) {
    rows.push({
      id: b.recordId,
      source: "SWEEPER",
      blockedSignal: `${b.marketId} · ${b.strategy}`,
      triggeredRules: b.ruleCodes,
      severity: "BLOCK",
      reason: b.reason,
      recommendedAction: "Sweeper blocked — no simulated trade.",
      createdAt: b.createdAt,
    });
  }

  for (const issue of input.portfolio.issues) {
    rows.push({
      id: `pr-${issue.code}`,
      source: "PORTFOLIO",
      blockedSignal: issue.code,
      triggeredRules: [issue.code],
      severity: issue.severity === "BLOCK" ? "BLOCK" : "WARN",
      reason: issue.message,
      recommendedAction: issue.severity === "BLOCK" ? "Halt new exposure." : "Reduce size / wait.",
      createdAt: input.portfolio.evaluatedAt,
    });
  }

  if (input.operator.killSwitchActive) {
    rows.push({
      id: "op-kill",
      source: "OPERATOR",
      blockedSignal: "KILL_SWITCH",
      triggeredRules: ["KILL_SWITCH"],
      severity: "BLOCK",
      reason: input.operator.killSwitchReason ?? "Kill switch active.",
      recommendedAction: "Resolve operator pause before scans.",
      createdAt: input.operator.checkedAt,
    });
  }

  const blockEvents = input.events.filter(
    (e) =>
      e.type === "EXECUTE_BLOCKED" ||
      e.type === "KILL_SWITCH_BLOCKED" ||
      e.type === "STATE_HEALTH_BLOCKED",
  );
  for (const e of blockEvents.slice(-10)) {
    rows.push({
      id: e.eventId,
      source: "RULES",
      blockedSignal: e.type,
      triggeredRules: [String((e.payload as { rule?: string }).rule ?? e.type)],
      severity: "BLOCK",
      reason: String((e.payload as { reason?: string }).reason ?? e.type),
      recommendedAction: "Advisory — review journal entry.",
      createdAt: e.timestamp,
    });
  }

  for (const e of input.poly.riskEvents.slice(0, 15)) {
    rows.push({
      id: e.eventId,
      source: "POLYMARKET",
      blockedSignal: e.marketId ?? "polymarket",
      triggeredRules: [e.ruleCode],
      severity: e.severity === "BLOCK" ? "BLOCK" : e.severity === "WARN" ? "WARN" : "INFO",
      reason: e.reason,
      recommendedAction: e.action,
      createdAt: e.createdAt,
    });
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
}

export function mapPaperBlotter(input: {
  ui: UiProjectionData;
  poly: PolymarketDashboardData;
}): TerminalPaperTradeRow[] {
  const rows: TerminalPaperTradeRow[] = [];

  for (const t of input.ui.trades.open) {
    rows.push({
      tradeId: t.tradeId,
      source: "TESTNET",
      symbolOrMarket: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice ?? 0,
      currentPrice: null,
      size: t.notionalUsd,
      unrealizedPnl: 0,
      realizedPnl: 0,
      status: t.status,
      createdAt: t.openedAt,
    });
  }

  for (const t of input.ui.trades.closed.slice(0, 20)) {
    rows.push({
      tradeId: t.tradeId,
      source: "TESTNET",
      symbolOrMarket: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice ?? 0,
      currentPrice: t.exitPrice ?? null,
      size: Number.parseFloat(t.qty) * (t.entryPrice ?? 0),
      unrealizedPnl: 0,
      realizedPnl: t.netPnl,
      status: t.status,
      createdAt: t.closedAt ?? t.openedAt,
    });
  }

  for (const t of input.poly.paperTrades) {
    rows.push({
      tradeId: t.tradeId,
      source: "POLYMARKET",
      symbolOrMarket: t.marketId,
      side: t.side,
      entryPrice: t.simulatedEntryPrice,
      currentPrice: t.currentPrice ?? null,
      size: t.simulatedSize,
      unrealizedPnl: t.unrealizedPnl,
      realizedPnl: t.realizedPnl,
      status: t.status,
      createdAt: t.createdAt,
    });
  }

  for (const t of input.poly.sweeperPaperTrades ?? []) {
    rows.push({
      tradeId: t.tradeId,
      source: "SWEEPER",
      symbolOrMarket: t.marketId,
      side: t.side,
      entryPrice: t.simulatedEntryPrice,
      currentPrice: null,
      size: t.simulatedSize,
      unrealizedPnl: t.unrealizedPnl,
      realizedPnl: t.realizedPnl,
      status: t.status,
      createdAt: t.createdAt,
    });
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);
}

export async function mapDecisionJournal(
  analysis: Awaited<ReturnType<typeof getLatestAnalysis>>,
): Promise<TerminalDecisionRow[]> {
  const records = await getAllLearningRecords();
  const rows: TerminalDecisionRow[] = records.map((r) => ({
    decisionId: r.decisionLogId || r.learningId,
    signalSource: `learning · ${r.symbol}`,
    thesis: r.originalThesis,
    riskNotes: r.riskNotes,
    outcome: r.actualOutcome,
    reflection: [r.whatWorked, r.whatFailed, r.avoidNextTime].filter(Boolean).join(" | ") || null,
    timestamp: r.createdAt,
  }));

  if (analysis.decisionLogId && analysis.verdict) {
    rows.unshift({
      decisionId: analysis.decisionLogId,
      signalSource: "analysis · latest verdict",
      thesis: analysis.verdict.reasons.join("; ") || analysis.verdict.verdict,
      riskNotes: analysis.noTradeBlockReason ?? "",
      outcome: analysis.verdict.verdict,
      reflection: analysis.scenarioNote,
      timestamp: new Date().toISOString(),
    });
  }

  return rows.slice(0, 40);
}

export function mapSystemHealth(input: {
  core: CoreHealthReport;
  poly: PolymarketDashboardData["health"];
}): TerminalSystemHealth {
  return {
    marketDataFresh: input.poly.cryptoDataFresh,
    polymarketDataFresh: input.poly.polymarketDataFresh,
    fairPriceEngineOk: input.poly.fairPriceEngineOk,
    riskEngineOk: input.poly.riskManagerOk && input.core.riskStatus !== "BLOCKED",
    paperSimulatorOk: input.poly.paperSimulatorOk,
    errorCount: input.poly.errorCount,
    messages: [
      ...input.core.blockingIssues.map((i) => i.message),
      ...input.poly.messages,
    ].slice(0, 12),
  };
}

export function mapConfigPanel(input: {
  operator: OperatorStatus;
}): TerminalConfigPanel {
  const config = loadPolymarketConfig();
  return {
    minEdge: config.minEdgeThreshold,
    minConfidence: config.minConfidenceScore,
    maxSpread: config.maxSpread,
    minLiquidity: config.minLiquidity,
    maxExposurePerMarket: config.maxExposurePerMarket,
    maxExposureTotal: config.maxExposureTotal,
    paperTradingEnabled: config.paperTradingEnabled,
    realTradingEnabled: false,
    killSwitchEnabled: input.operator.killSwitchActive,
  };
}
