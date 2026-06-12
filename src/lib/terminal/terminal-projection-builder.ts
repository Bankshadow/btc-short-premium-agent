import { unstable_noStore as noStore } from "next/cache";
import { getLatestAnalysis } from "@/lib/analysis/analysis-runner";
import { getLatestCollaboration } from "@/lib/collaboration/collaboration-runner";
import { evaluateCoreHealth } from "@/lib/core/core-health";
import { getUiBundle } from "@/lib/core/get-ui-bundle";
import { getEvents } from "@/lib/journal/journal-query";
import { createCryptoDataAdapter } from "@/lib/polymarket/adapters/mock-crypto-data-adapter";
import { loadPolymarketConfig } from "@/lib/polymarket/config";
import { getPolymarketDashboard } from "@/lib/polymarket/run-cycle";
import { getOperatorStatus } from "@/lib/operator/operator-actions";
import { getLatestPortfolioRisk } from "@/lib/portfolio-risk/portfolio-risk-manager";
import { getLatestRegimeClassification } from "@/lib/regime/regime-retrieval";
import { getLatestSwarmReport } from "@/lib/skills/mirofish-swarm/swarm-runner";
import {
  mapAgentDebate,
  mapCommandCenter,
  mapConfigPanel,
  mapDecisionJournal,
  mapMarketData,
  mapPaperBlotter,
  mapPolymarketMispricing,
  mapRiskGuard,
  mapSweeperRows,
  mapSystemHealth,
} from "./terminal-mappers";
import type { TerminalBundle } from "./terminal-types";

export function emptyTerminalBundle(): TerminalBundle {
  const now = new Date().toISOString();
  return {
    meta: {
      builtAt: now,
      source: "PARTIAL_FALLBACK",
      warnings: ["No aggregation run yet."],
      paperOnly: true,
      realTradingEnabled: false,
      liveLocked: true,
    },
    commandCenter: {
      btcRegime: "UNKNOWN",
      ethRegime: "UNKNOWN",
      activeThesis: null,
      thesisConfidence: null,
      riskMode: "NORMAL",
      systemHealthStatus: "WARNING",
      paperTradingStatus: "ENABLED",
      killSwitchActive: false,
      killSwitchReason: null,
      engineState: "RUNNING",
    },
    marketData: {
      btc: {
        price: 0,
        fundingRate: null,
        fundingSimulated: true,
        volatility: 0,
        trend: "UNKNOWN",
        momentum: 0,
        dataFreshnessSec: Infinity,
        quality: "UNKNOWN",
      },
      eth: {
        price: 0,
        fundingRate: null,
        fundingSimulated: true,
        volatility: 0,
        trend: "UNKNOWN",
        momentum: 0,
        dataFreshnessSec: Infinity,
        quality: "UNKNOWN",
      },
    },
    polymarketMispricing: [],
    sweeperScanner: [],
    agentDebate: {
      bullThesis: null,
      bearThesis: null,
      quantView: null,
      riskManagerView: null,
      committeeView: null,
      finalRecommendation: null,
      unresolvedDisagreements: [],
      advisoryOnly: true,
    },
    riskGuard: [],
    paperBlotter: [],
    decisionJournal: [],
    systemHealth: {
      marketDataFresh: false,
      polymarketDataFresh: false,
      fairPriceEngineOk: false,
      riskEngineOk: false,
      paperSimulatorOk: false,
      errorCount: 0,
      messages: [],
    },
    configPanel: {
      minEdge: 0.03,
      minConfidence: 0.55,
      maxSpread: 0.08,
      minLiquidity: 500,
      maxExposurePerMarket: 100,
      maxExposureTotal: 500,
      paperTradingEnabled: true,
      realTradingEnabled: false,
      killSwitchEnabled: false,
    },
  };
}

export async function buildTerminalBundle(): Promise<TerminalBundle> {
  noStore();
  const warnings: string[] = [];

  const [
    ui,
    regime,
    analysis,
    operator,
    coreHealth,
    polyDashboard,
    collaboration,
    swarm,
    portfolio,
    events,
  ] = await Promise.all([
    getUiBundle().catch(() => {
      warnings.push("Projection bundle unavailable.");
      return null;
    }),
    getLatestRegimeClassification().catch(() => null),
    getLatestAnalysis().catch(() => {
      warnings.push("Analysis unavailable.");
      return {
        runId: null,
        decisionLogId: null,
        verdict: null,
        previewId: null,
        scenarioContext: null,
        swarmAgreement: null,
        scenarioNote: null,
        regime: null,
        noTradeBlockReason: null,
        strategyVersionId: null,
      };
    }),
    getOperatorStatus().catch(() => {
      warnings.push("Operator status unavailable.");
      return null;
    }),
    evaluateCoreHealth().catch(() => {
      warnings.push("Core health check failed.");
      return null;
    }),
    Promise.resolve(getPolymarketDashboard()).catch(() => {
      warnings.push("Polymarket dashboard unavailable.");
      return null;
    }),
    getLatestCollaboration().catch(() => null),
    getLatestSwarmReport().catch(() => null),
    getLatestPortfolioRisk().catch(() => {
      warnings.push("Portfolio risk unavailable.");
      return null;
    }),
    getEvents().catch(() => []),
  ]);

  const config = loadPolymarketConfig();
  let btcSnap = polyDashboard?.cryptoSnapshots?.find((c) => c.symbol === "BTC");
  let ethSnap = polyDashboard?.cryptoSnapshots?.find((c) => c.symbol === "ETH");

  if (!btcSnap || !ethSnap) {
    try {
      const adapter = createCryptoDataAdapter(config.mockMode);
      btcSnap = btcSnap ?? (await adapter.fetchBtcSnapshot());
      ethSnap = ethSnap ?? (await adapter.fetchEthSnapshot());
    } catch {
      warnings.push("Crypto snapshots unavailable.");
    }
  }

  const operatorStatus = operator ?? {
    killSwitchActive: false,
    killSwitchReason: null,
    riskMode: "NORMAL" as const,
    engineState: "RUNNING" as const,
    pendingApprovals: [],
    allowedSymbols: [],
    maxNotionalUsd: 0,
    latestManualNotes: [],
    liveLocked: true as const,
    checkedAt: new Date().toISOString(),
  };

  const poly = polyDashboard ?? {
    markets: [],
    fairPrices: [],
    opportunities: [],
    signals: [],
    blockedSignals: [],
    paperTrades: [],
    riskEvents: [],
    cryptoSnapshots: [],
    health: {
      status: "WARNING" as const,
      polymarketDataFresh: false,
      cryptoDataFresh: false,
      fairPriceEngineOk: false,
      paperSimulatorOk: false,
      riskManagerOk: false,
      killSwitchActive: false,
      lastSuccessfulUpdate: null,
      errorCount: 0,
      messages: ["No Polymarket cycle run yet."],
      realTradingEnabled: false as const,
      paperTradingEnabled: true,
    },
    commentary: [],
    orderBooks: [],
    sweeperOpportunities: [],
    blockedSweeperOpportunities: [],
    sweeperPaperTrades: [],
  };

  const core = coreHealth ?? {
    status: "WARNING" as const,
    eventJournalStatus: "WARNING" as const,
    projectionStatus: "WARNING" as const,
    lifecycleStatus: "WARNING" as const,
    riskStatus: "DEFENSIVE" as const,
    exchangeStatus: "UNKNOWN",
    operatorStatus: "UNKNOWN",
    safetyStatus: "OK" as const,
    blockingIssues: [],
    warnings: [],
    rawWarningCount: 0,
    lastCheckedAt: new Date().toISOString(),
    liveLocked: true as const,
  };

  const uiData = ui ?? (await import("@/lib/core/ui-projection-data")).getDefaultUiProjectionData();

  const portfolioReport = portfolio ?? {
    status: "OK" as const,
    evaluatedAt: new Date().toISOString(),
    issues: [],
    blocksExecution: false,
    dailyPnl: 0,
    drawdownPct: 0,
    openExposureUsd: 0,
    openPositions: 0,
    consecutiveLosses: 0,
    cooldownUntil: null,
    message: "Portfolio risk not evaluated.",
    liveLocked: true as const,
  };

  const decisionJournal = await mapDecisionJournal(analysis);

  return {
    meta: {
      builtAt: new Date().toISOString(),
      source: warnings.length > 0 ? "PARTIAL_FALLBACK" : "LIVE_AGGREGATION",
      warnings,
      paperOnly: true,
      realTradingEnabled: false,
      liveLocked: true,
    },
    commandCenter: mapCommandCenter({
      regime,
      analysis,
      operator: operatorStatus,
      coreHealth: core,
      polyHealth: poly.health,
    }),
    marketData: mapMarketData({ btc: btcSnap, eth: ethSnap, regime }),
    polymarketMispricing: mapPolymarketMispricing(poly),
    sweeperScanner: mapSweeperRows({
      opportunities: poly.sweeperOpportunities ?? [],
      blocked: poly.blockedSweeperOpportunities ?? [],
      paperTrades: poly.sweeperPaperTrades ?? [],
    }),
    agentDebate: mapAgentDebate({ collaboration, swarm, analysis, regime }),
    riskGuard: mapRiskGuard({ poly, portfolio: portfolioReport, operator: operatorStatus, events }),
    paperBlotter: mapPaperBlotter({ ui: uiData, poly }),
    decisionJournal,
    systemHealth: mapSystemHealth({ core, poly: poly.health }),
    configPanel: mapConfigPanel({ operator: operatorStatus }),
  };
}

export async function getTerminalBundle(): Promise<TerminalBundle> {
  return buildTerminalBundle();
}
