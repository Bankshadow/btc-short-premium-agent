import { appendEvent } from "@/lib/journal/journal-query";
import { buildOrderBooks } from "./adapters/mock-order-book-adapter";
import { createCryptoDataAdapter } from "./adapters/mock-crypto-data-adapter";
import { createPolymarketAdapter } from "./adapters/mock-polymarket-adapter";
import { loadPolymarketConfig } from "./config";
import { estimateFairProbabilities } from "./fair-probability-engine";
import { discoverCryptoPolymarketMarkets } from "./market-discovery";
import { sumDailySimulatedLoss, toRiskEventRecord } from "./risk-manager";
import { simulateSweeperPaperTrade } from "./sweeper-paper";
import { checkSweeperOpportunityRisk, toBlockedSweeperRecord } from "./sweeper-risk";
import { scanSweeperOpportunities, SWEEPER_STRATEGIES } from "./sweeper-scanner";
import type { SweeperScanResult, SweeperStrategy } from "./sweeper-types";
import { appendPolymarketStore, readPolymarketStore } from "./store";
import type { OrderBookSnapshot, SweeperOpportunity, SweeperPaperTrade } from "./sweeper-types";
import type { BlockedSweeperRecord } from "./sweeper-types";
import type { RiskEventRecord } from "./types";

function newRunId(): string {
  return `swprun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyByStrategy(): Record<SweeperStrategy, number> {
  return {
    BINARY_UNDER_ONE_ARB: 0,
    DUMP_AND_HEDGE: 0,
    WIDE_SPREAD_CAPTURE: 0,
    CRYPTO_MARKET_LAG: 0,
    NEAR_EXPIRY_LIQUIDITY_GAP: 0,
  };
}

export async function runPolymarketSweeperCycle(): Promise<SweeperScanResult> {
  const runId = newRunId();
  const config = loadPolymarketConfig();
  const store = readPolymarketStore();

  await appendEvent({
    type: "SWEEPER_SCAN_STARTED",
    environment: "simulation",
    runId,
    payload: { strategies: SWEEPER_STRATEGIES, paperOnly: true },
  });

  const polyAdapter = createPolymarketAdapter(config.mockMode);
  const cryptoAdapter = createCryptoDataAdapter(config.mockMode);
  const markets = await discoverCryptoPolymarketMarkets(polyAdapter);
  const btc = await cryptoAdapter.fetchBtcSnapshot();
  const eth = await cryptoAdapter.fetchEthSnapshot();
  const fairPrices = estimateFairProbabilities({ markets, btc, eth });
  const orderBooks: OrderBookSnapshot[] = buildOrderBooks(markets);

  const rawOpportunities = scanSweeperOpportunities({
    markets,
    fairPrices,
    btc,
    eth,
    config,
    books: orderBooks,
  });

  const dailyLoss = sumDailySimulatedLoss(store.paperTrades);
  const approved: SweeperOpportunity[] = [];
  const blocked: BlockedSweeperRecord[] = [];
  const sweeperPaperTrades: SweeperPaperTrade[] = [];
  const riskEvents: RiskEventRecord[] = [];
  const byStrategy = emptyByStrategy();

  for (const opp of rawOpportunities) {
    byStrategy[opp.strategy] += 1;
    const market = markets.find((m) => m.marketId === opp.marketId);
    if (!market) continue;

    const risk = checkSweeperOpportunityRisk({
      opportunity: opp,
      market,
      config,
      btc,
      eth,
      paperTrades: [...store.paperTrades, ...store.sweeperPaperTrades, ...sweeperPaperTrades],
      dailySimulatedLoss: dailyLoss,
    });

    if (!risk.allowed) {
      const blockedRecord = toBlockedSweeperRecord({ opportunity: opp, risk });
      blocked.push(blockedRecord);
      for (const code of risk.ruleCodes) {
        riskEvents.push(
          toRiskEventRecord({
            marketId: market.marketId,
            ruleCode: `SWEEPER_${code}`,
            severity: risk.severity,
            action: config.killSwitchActive ? "KILL_SWITCH" : "BLOCK",
            reason: `[${opp.strategy}] ${risk.reason}`,
          }),
        );
      }
      await appendEvent({
        type: "SWEEPER_OPPORTUNITY_BLOCKED",
        environment: "simulation",
        runId,
        payload: {
          opportunityId: opp.opportunityId,
          marketId: opp.marketId,
          strategy: opp.strategy,
          rules: risk.ruleCodes,
          edge: opp.estimatedEdge,
        },
      });
      continue;
    }

    approved.push({ ...opp, status: "OPEN" });
    await appendEvent({
      type: "SWEEPER_OPPORTUNITY_DETECTED",
      environment: "simulation",
      runId,
      payload: {
        opportunityId: opp.opportunityId,
        marketId: opp.marketId,
        strategy: opp.strategy,
        edge: opp.estimatedEdge,
        side: opp.side,
      },
    });

    if (config.paperTradingEnabled) {
      const paper = simulateSweeperPaperTrade({ opportunity: opp, market });
      if (paper.status !== "CANCELLED") {
        sweeperPaperTrades.push(paper);
        await appendEvent({
          type: "SWEEPER_PAPER_TRADE_CREATED",
          environment: "simulation",
          runId,
          payload: {
            tradeId: paper.tradeId,
            opportunityId: paper.opportunityId,
            strategy: paper.strategy,
            marketId: paper.marketId,
          },
        });
      }
    }
  }

  for (const evt of riskEvents) {
    await appendEvent({
      type: "POLYMARKET_RISK_EVENT",
      environment: "simulation",
      runId,
      payload: { ...evt, source: "sweeper" },
    });
  }

  appendPolymarketStore({
    orderBooks,
    sweeperOpportunities: [...store.sweeperOpportunities, ...approved].slice(-200),
    blockedSweeperOpportunities: blocked,
    sweeperPaperTrades: [...store.sweeperPaperTrades, ...sweeperPaperTrades],
    riskEvents: [...store.riskEvents, ...riskEvents],
  });

  await appendEvent({
    type: "SWEEPER_SCAN_COMPLETED",
    environment: "simulation",
    runId,
    payload: {
      booksScanned: orderBooks.length,
      detected: approved.length,
      blocked: blocked.length,
      paperTrades: sweeperPaperTrades.length,
    },
  });

  return {
    ok: true,
    runId,
    booksScanned: orderBooks.length,
    opportunitiesDetected: approved.length,
    opportunitiesBlocked: blocked.length,
    paperTradesCreated: sweeperPaperTrades.length,
    byStrategy,
  };
}
