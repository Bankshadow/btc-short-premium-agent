import { appendEvent } from "@/lib/journal/journal-query";
import { createCryptoDataAdapter } from "./adapters/mock-crypto-data-adapter";
import { createPolymarketAdapter } from "./adapters/mock-polymarket-adapter";
import { buildCycleCommentary, buildPreLiveReviewCommentary } from "./commentary";
import { loadPolymarketConfig } from "./config";
import { estimateFairProbabilities } from "./fair-probability-engine";
import { buildPolymarketHealth } from "./health";
import { discoverCryptoPolymarketMarkets } from "./market-discovery";
import { detectMispricingSignals } from "./mispricing-detector";
import { markPaperTradesToMarket, simulatePaperFill } from "./paper-trading-simulator";
import {
  checkSignalRisk,
  sumDailySimulatedLoss,
  toBlockedSignalRecord,
  toRiskEventRecord,
} from "./risk-manager";
import { appendPolymarketStore, buildDashboardData, readPolymarketStore } from "./store";
import type {
  BlockedSignalRecord,
  MispricingSignal,
  PaperTradeRecord,
  PolymarketCycleResult,
  RiskEventRecord,
} from "./types";

function newRunId(): string {
  return `pmrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function runPolymarketCycle(): Promise<PolymarketCycleResult> {
  const runId = newRunId();
  const config = loadPolymarketConfig();
  const store = readPolymarketStore();
  let errorCount = store.errorCount;

  await appendEvent({
    type: "POLYMARKET_SCAN_STARTED",
    environment: "simulation",
    runId,
    payload: { mockMode: config.mockMode, paperOnly: true },
  });

  try {
    const polyAdapter = createPolymarketAdapter(config.mockMode);
    const cryptoAdapter = createCryptoDataAdapter(config.mockMode);

    const markets = await discoverCryptoPolymarketMarkets(polyAdapter);
    const btc = await cryptoAdapter.fetchBtcSnapshot();
    const eth = await cryptoAdapter.fetchEthSnapshot();
    const fairPrices = estimateFairProbabilities({ markets, btc, eth });
    const { opportunities, signals: rawSignals } = detectMispricingSignals({
      markets,
      fairPrices,
      config,
    });

    const existingTrades = markPaperTradesToMarket({
      trades: store.paperTrades,
      markets,
    });
    const dailyLoss = sumDailySimulatedLoss(existingTrades);

    const approvedSignals: MispricingSignal[] = [];
    const blockedSignals: BlockedSignalRecord[] = [];
    const riskEvents: RiskEventRecord[] = [];
    const newPaperTrades: PaperTradeRecord[] = [];

    for (const signal of rawSignals) {
      const market = markets.find((m) => m.marketId === signal.marketId);
      if (!market) continue;

      const risk = checkSignalRisk({
        signal,
        market,
        config,
        btc,
        eth,
        paperTrades: [...existingTrades, ...newPaperTrades],
        dailySimulatedLoss: dailyLoss,
      });

      if (!risk.allowed) {
        const blocked = toBlockedSignalRecord({ signal, risk });
        blockedSignals.push(blocked);
        for (const code of risk.ruleCodes) {
          const evt = toRiskEventRecord({
            marketId: market.marketId,
            ruleCode: code,
            severity: risk.severity,
            action: config.killSwitchActive ? "KILL_SWITCH" : "BLOCK",
            reason: risk.reason,
          });
          riskEvents.push(evt);
        }
        await appendEvent({
          type: "POLYMARKET_SIGNAL_BLOCKED",
          environment: "simulation",
          runId,
          payload: { signalId: signal.signalId, marketId: market.marketId, rules: risk.ruleCodes },
        });
        continue;
      }

      const commentary = buildCycleCommentary({
        markets: [market],
        fairPrices: fairPrices.filter((f) => f.marketId === market.marketId),
        signals: [signal],
        blocked: [],
        riskEvents: [],
      })[0];

      const approved: MispricingSignal = {
        ...signal,
        status: "OPEN",
        commentary,
      };
      approvedSignals.push(approved);

      await appendEvent({
        type: "POLYMARKET_SIGNAL_CREATED",
        environment: "simulation",
        runId,
        payload: {
          signalId: approved.signalId,
          marketId: market.marketId,
          side: approved.side,
          edge: approved.estimatedEdge,
        },
      });

      if (config.paperTradingEnabled) {
        const paper = simulatePaperFill({ signal: approved, market });
        if (paper.status !== "CANCELLED") {
          newPaperTrades.push(paper);
          await appendEvent({
            type: "POLYMARKET_PAPER_TRADE_CREATED",
            environment: "simulation",
            runId,
            payload: {
              tradeId: paper.tradeId,
              signalId: paper.signalId,
              marketId: paper.marketId,
              side: paper.side,
            },
          });
        }
      }
    }

    const capturedAt = markets[0]?.capturedAt ?? new Date().toISOString();
    const health = buildPolymarketHealth({
      config,
      btc,
      eth,
      lastSuccessfulUpdate: new Date().toISOString(),
      errorCount,
      polymarketCapturedAt: capturedAt,
    });

    const commentary = [
      ...buildCycleCommentary({
        markets,
        fairPrices,
        signals: approvedSignals,
        blocked: blockedSignals,
        riskEvents,
      }),
      buildPreLiveReviewCommentary({
        health,
        openSignals: approvedSignals.length,
        blockedCount: blockedSignals.length,
      }),
    ];

    for (const evt of riskEvents) {
      await appendEvent({
        type: "POLYMARKET_RISK_EVENT",
        environment: "simulation",
        runId,
        payload: { ...evt },
      });
    }

    appendPolymarketStore({
      lastSuccessfulUpdate: new Date().toISOString(),
      errorCount,
      latestMarkets: markets,
      fairPrices,
      opportunities,
      signals: [...store.signals, ...approvedSignals].slice(-200),
      blockedSignals,
      paperTrades: [...existingTrades, ...newPaperTrades],
      riskEvents,
      cryptoSnapshots: [btc, eth],
      health,
      commentary,
      marketSnapshots: [
        {
          snapshotId: `snap-${Date.now()}`,
          markets,
          capturedAt,
        },
      ],
    });

    await appendEvent({
      type: "POLYMARKET_CYCLE_COMPLETED",
      environment: "simulation",
      runId,
      payload: {
        marketsScanned: markets.length,
        signalsCreated: approvedSignals.length,
        signalsBlocked: blockedSignals.length,
        paperTradesCreated: newPaperTrades.length,
      },
    });

    return {
      ok: true,
      runId,
      marketsScanned: markets.length,
      signalsCreated: approvedSignals.length,
      signalsBlocked: blockedSignals.length,
      paperTradesCreated: newPaperTrades.length,
      health,
      commentary,
    };
  } catch (err) {
    errorCount += 1;
    appendPolymarketStore({ errorCount });
    await appendEvent({
      type: "ERROR_RECORDED",
      environment: "simulation",
      runId,
      payload: {
        source: "polymarket-cycle",
        message: err instanceof Error ? err.message : "Polymarket cycle failed",
      },
    });
    throw err;
  }
}

export function getPolymarketDashboard() {
  const store = readPolymarketStore();
  const config = loadPolymarketConfig();
  return {
    config: { ...config, realTradingEnabled: false as const },
    ...buildDashboardData(store),
  };
}

export function setPolymarketKillSwitch(active: boolean): void {
  process.env.POLYMARKET_KILL_SWITCH = active ? "true" : "false";
  appendPolymarketStore({});
}
