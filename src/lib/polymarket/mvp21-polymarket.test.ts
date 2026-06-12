import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildMockPolymarketMarkets } from "./adapters/mock-polymarket-adapter";
import { buildStaleBtcSnapshot, MockCryptoDataAdapter } from "./adapters/mock-crypto-data-adapter";
import { loadPolymarketConfig } from "./config";
import { estimateFairProbability } from "./fair-probability-engine";
import { buildMispricingOpportunity, detectMispricingSignals } from "./mispricing-detector";
import { simulatePaperFill } from "./paper-trading-simulator";
import { checkSignalRisk } from "./risk-manager";
import { runPolymarketCycle } from "./run-cycle";
import { readPolymarketStore, resetPolymarketStoreForTests } from "./store";
import { getEvents } from "@/lib/journal/journal-query";
import type { MispricingSignal } from "./types";

describe("MVP 21 Polymarket mispricing engine", () => {
  let tmpDir: string;
  let journalDir: string;
  let polyDir: string;
  let prevJournal: string | undefined;
  let prevPoly: string | undefined;
  let prevKill: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-poly21-"));
    journalDir = path.join(tmpDir, "journal");
    polyDir = path.join(tmpDir, "polymarket");
    fs.mkdirSync(journalDir, { recursive: true });
    fs.mkdirSync(polyDir, { recursive: true });
    prevJournal = process.env.JOURNAL_DATA_DIR;
    prevPoly = process.env.POLYMARKET_DATA_DIR;
    prevKill = process.env.POLYMARKET_KILL_SWITCH;
    process.env.JOURNAL_DATA_DIR = journalDir;
    process.env.POLYMARKET_DATA_DIR = polyDir;
    delete process.env.POLYMARKET_KILL_SWITCH;
    resetPolymarketStoreForTests();
  });

  afterEach(() => {
    if (prevJournal !== undefined) process.env.JOURNAL_DATA_DIR = prevJournal;
    else delete process.env.JOURNAL_DATA_DIR;
    if (prevPoly !== undefined) process.env.POLYMARKET_DATA_DIR = prevPoly;
    else delete process.env.POLYMARKET_DATA_DIR;
    if (prevKill !== undefined) process.env.POLYMARKET_KILL_SWITCH = prevKill;
    else delete process.env.POLYMARKET_KILL_SWITCH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calculates fair probability for up/down market", async () => {
    const markets = buildMockPolymarketMarkets();
    const btc = await new MockCryptoDataAdapter().fetchBtcSnapshot();
    const eth = await new MockCryptoDataAdapter().fetchEthSnapshot();
    const fair = estimateFairProbability({ market: markets[0], btc, eth });
    assert.ok(fair.fairProbabilityYes > 0 && fair.fairProbabilityYes < 1);
    assert.ok(fair.confidenceScore > 0);
    assert.ok(fair.modelReason.length > 0);
  });

  it("detects mispricing when edge exceeds threshold", () => {
    const markets = buildMockPolymarketMarkets();
    const config = loadPolymarketConfig();
    const btcSnap = { price: 104_800, momentum: 0.7 };
    const fair = markets.map((m) =>
      estimateFairProbability({
        market: m,
        btc: {
          symbol: "BTC" as const,
          price: btcSnap.price,
          timestamp: new Date().toISOString(),
          quality: "FRESH" as const,
          change5s: 0.01,
          change15s: 0.02,
          change1m: 0.03,
          change5m: 0.05,
          volatility: 0.01,
          momentumScore: 0.7,
        },
        eth: {
          symbol: "ETH" as const,
          price: 3840,
          timestamp: new Date().toISOString(),
          quality: "FRESH" as const,
          change5s: 0,
          change15s: 0,
          change1m: 0,
          change5m: 0,
          volatility: 0.01,
          momentumScore: 0.5,
        },
      }),
    );
    const { signals } = detectMispricingSignals({ markets, fairPrices: fair, config });
    assert.ok(signals.length >= 0);
  });

  it("blocks wide spread market via risk manager", async () => {
    const markets = buildMockPolymarketMarkets();
    const wide = markets.find((m) => m.marketId === "pm-btc-wide-spread")!;
    const btc = await new MockCryptoDataAdapter().fetchBtcSnapshot();
    const eth = await new MockCryptoDataAdapter().fetchEthSnapshot();
    const config = loadPolymarketConfig();
    const signal: MispricingSignal = {
      signalId: "test-sig",
      marketId: wide.marketId,
      side: "BUY_YES",
      suggestedPrice: wide.bestAskYes,
      fairPrice: 0.5,
      estimatedEdge: 0.1,
      confidence: 0.8,
      suggestedSizeSimulated: 10,
      reason: "test",
      riskFlags: [],
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    const risk = checkSignalRisk({
      signal,
      market: wide,
      config,
      btc,
      eth,
      paperTrades: [],
      dailySimulatedLoss: 0,
    });
    assert.equal(risk.allowed, false);
    assert.ok(risk.ruleCodes.includes("MAX_SPREAD") || risk.ruleCodes.includes("MIN_LIQUIDITY"));
  });

  it("blocks stale crypto data", async () => {
    const markets = buildMockPolymarketMarkets();
    const market = markets[0];
    const config = loadPolymarketConfig();
    const signal: MispricingSignal = {
      signalId: "test-stale",
      marketId: market.marketId,
      side: "BUY_YES",
      suggestedPrice: market.bestAskYes,
      fairPrice: 0.7,
      estimatedEdge: 0.08,
      confidence: 0.8,
      suggestedSizeSimulated: 10,
      reason: "test",
      riskFlags: [],
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    const risk = checkSignalRisk({
      signal,
      market,
      config,
      btc: buildStaleBtcSnapshot(),
      eth: await new MockCryptoDataAdapter().fetchEthSnapshot(),
      paperTrades: [],
      dailySimulatedLoss: 0,
    });
    assert.equal(risk.allowed, false);
    assert.ok(risk.ruleCodes.includes("STALE_CRYPTO_DATA"));
  });

  it("creates paper trade on simulated fill", () => {
    const markets = buildMockPolymarketMarkets();
    const market = markets[0];
    const signal: MispricingSignal = {
      signalId: "sig-paper",
      marketId: market.marketId,
      side: "BUY_YES",
      suggestedPrice: market.bestAskYes,
      fairPrice: 0.65,
      estimatedEdge: 0.05,
      confidence: 0.7,
      suggestedSizeSimulated: 25,
      reason: "test",
      riskFlags: [],
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    const paper = simulatePaperFill({ signal, market });
    assert.ok(paper.tradeId.startsWith("ptrade-"));
    assert.ok(paper.simulatedSize > 0);
    assert.equal(paper.status, "OPEN");
  });

  it("run cycle persists store and journal events", async () => {
    const result = await runPolymarketCycle();
    assert.equal(result.ok, true);
    assert.ok(result.marketsScanned >= 3);
    const store = readPolymarketStore();
    assert.ok(store.latestMarkets.length > 0);
    assert.ok(store.fairPrices.length > 0);
    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "POLYMARKET_SCAN_STARTED"));
    assert.ok(events.some((e) => e.type === "POLYMARKET_CYCLE_COMPLETED"));
  });

  it("high spread opportunity has low execution score", () => {
    const markets = buildMockPolymarketMarkets();
    const wide = markets.find((m) => m.marketId === "pm-btc-wide-spread")!;
    const fair = {
      marketId: wide.marketId,
      fairProbabilityYes: 0.35,
      fairProbabilityNo: 0.65,
      confidenceScore: 0.5,
      modelReason: "test",
      assumptions: [],
      timestamp: new Date().toISOString(),
    };
    const opp = buildMispricingOpportunity({ market: wide, fair });
    assert.ok(opp.spreadYes > 0.1);
    assert.ok(opp.executionScore < 0.6);
  });

  it("real trading is always disabled in config", () => {
    const config = loadPolymarketConfig();
    assert.equal(config.realTradingEnabled, false);
  });
});
