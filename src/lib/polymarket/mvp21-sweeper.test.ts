import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildOrderBooks } from "./adapters/mock-order-book-adapter";
import { buildMockPolymarketMarkets } from "./adapters/mock-polymarket-adapter";
import { buildStaleBtcSnapshot, MockCryptoDataAdapter } from "./adapters/mock-crypto-data-adapter";
import { loadPolymarketConfig } from "./config";
import { estimateFairProbabilities } from "./fair-probability-engine";
import { runPolymarketSweeperCycle } from "./run-sweeper-cycle";
import { simulateSweeperPaperTrade } from "./sweeper-paper";
import { checkSweeperOpportunityRisk } from "./sweeper-risk";
import { scanSweeperOpportunities, SWEEPER_STRATEGIES } from "./sweeper-scanner";
import { readPolymarketStore, resetPolymarketStoreForTests } from "./store";
import { getEvents } from "@/lib/journal/journal-query";

describe("MVP 21.1 Polymarket sweeper scanner", () => {
  let tmpDir: string;
  let journalDir: string;
  let polyDir: string;
  let prevJournal: string | undefined;
  let prevPoly: string | undefined;
  let prevKill: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2-sweeper-"));
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

  it("detects all five sweeper strategy types from mock books", async () => {
    const markets = buildMockPolymarketMarkets();
    const config = loadPolymarketConfig();
    const btc = await new MockCryptoDataAdapter().fetchBtcSnapshot();
    const eth = await new MockCryptoDataAdapter().fetchEthSnapshot();
    const fairPrices = estimateFairProbabilities({ markets, btc, eth });
    const books = buildOrderBooks(markets);
    const opps = scanSweeperOpportunities({ markets, fairPrices, btc, eth, config, books });

    const strategies = new Set(opps.map((o) => o.strategy));
    for (const s of SWEEPER_STRATEGIES) {
      assert.ok(strategies.has(s), `expected strategy ${s}`);
    }
  });

  it("detects binary under-$1 arb on mock market", () => {
    const markets = buildMockPolymarketMarkets();
    const arb = markets.find((m) => m.marketId === "pm-binary-arb-mock")!;
    const config = loadPolymarketConfig();
    const books = buildOrderBooks([arb]);
    const opps = scanSweeperOpportunities({
      markets: [arb],
      fairPrices: [],
      btc: { symbol: "BTC", price: 104_000, timestamp: new Date().toISOString(), quality: "FRESH", change5s: 0, change15s: 0.01, change1m: 0, change5m: 0, volatility: 0.01, momentumScore: 0.5 },
      eth: { symbol: "ETH", price: 3840, timestamp: new Date().toISOString(), quality: "FRESH", change5s: 0, change15s: 0, change1m: 0, change5m: 0, volatility: 0.01, momentumScore: 0.5 },
      config,
      books,
    });
    const arbOpp = opps.find((o) => o.strategy === "BINARY_UNDER_ONE_ARB");
    assert.ok(arbOpp);
    assert.equal(arbOpp.side, "BUNDLE_YES_NO");
    assert.ok(arbOpp.estimatedEdge > config.minEdgeThreshold);
  });

  it("blocks sweeper opportunity when kill switch active", async () => {
    process.env.POLYMARKET_KILL_SWITCH = "true";
    const markets = buildMockPolymarketMarkets();
    const market = markets.find((m) => m.marketId === "pm-binary-arb-mock")!;
    const config = loadPolymarketConfig();
    const btc = await new MockCryptoDataAdapter().fetchBtcSnapshot();
    const eth = await new MockCryptoDataAdapter().fetchEthSnapshot();
    const books = buildOrderBooks([market]);
    const opps = scanSweeperOpportunities({
      markets: [market],
      fairPrices: [],
      btc,
      eth,
      config,
      books,
    });
    const opp = opps[0];
    assert.ok(opp);
    const risk = checkSweeperOpportunityRisk({
      opportunity: opp,
      market,
      config,
      btc,
      eth,
      paperTrades: [],
      dailySimulatedLoss: 0,
    });
    assert.equal(risk.allowed, false);
    assert.ok(risk.ruleCodes.includes("KILL_SWITCH"));
  });

  it("blocks sweeper on stale crypto data", async () => {
    const markets = buildMockPolymarketMarkets();
    const market = markets[0];
    const config = loadPolymarketConfig();
    const books = buildOrderBooks([market]);
    const opps = scanSweeperOpportunities({
      markets: [market],
      fairPrices: [],
      btc: buildStaleBtcSnapshot(),
      eth: await new MockCryptoDataAdapter().fetchEthSnapshot(),
      config,
      books,
    });
    if (opps.length === 0) return;
    const risk = checkSweeperOpportunityRisk({
      opportunity: opps[0],
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

  it("simulates sweeper paper trade without real execution", () => {
    const markets = buildMockPolymarketMarkets();
    const market = markets.find((m) => m.marketId === "pm-binary-arb-mock")!;
    const config = loadPolymarketConfig();
    const books = buildOrderBooks([market]);
    const opps = scanSweeperOpportunities({
      markets: [market],
      fairPrices: [],
      btc: { symbol: "BTC", price: 104_000, timestamp: new Date().toISOString(), quality: "FRESH", change5s: 0, change15s: 0.01, change1m: 0, change5m: 0, volatility: 0.01, momentumScore: 0.5 },
      eth: { symbol: "ETH", price: 3840, timestamp: new Date().toISOString(), quality: "FRESH", change5s: 0, change15s: 0, change1m: 0, change5m: 0, volatility: 0.01, momentumScore: 0.5 },
      config,
      books,
    });
    const paper = simulateSweeperPaperTrade({ opportunity: opps[0], market });
    assert.ok(paper.tradeId.startsWith("swptrade-"));
    assert.ok(paper.simulatedSize > 0);
    assert.equal(paper.status, "OPEN");
  });

  it("run sweeper cycle persists store, blocked log, and journal events", async () => {
    const result = await runPolymarketSweeperCycle();
    assert.equal(result.ok, true);
    assert.ok(result.booksScanned >= 3);
    assert.ok(result.opportunitiesDetected + result.opportunitiesBlocked > 0);

    const store = readPolymarketStore();
    assert.ok(store.orderBooks.length > 0);
    assert.ok(store.sweeperOpportunities.length + store.blockedSweeperOpportunities.length > 0);

    const events = await getEvents();
    assert.ok(events.some((e) => e.type === "SWEEPER_SCAN_STARTED"));
    assert.ok(events.some((e) => e.type === "SWEEPER_SCAN_COMPLETED"));
  });

  it("logs every blocked sweeper opportunity to journal", async () => {
    process.env.POLYMARKET_KILL_SWITCH = "true";
    await runPolymarketSweeperCycle();
    const events = await getEvents();
    const blocked = events.filter((e) => e.type === "SWEEPER_OPPORTUNITY_BLOCKED");
    assert.ok(blocked.length > 0, "expected blocked sweeper journal events");
  });

  it("real trading remains disabled", () => {
    const config = loadPolymarketConfig();
    assert.equal(config.realTradingEnabled, false);
  });
});
