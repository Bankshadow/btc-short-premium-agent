import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  BlockedSignalRecord,
  FairProbabilityResult,
  MarketSnapshotRecord,
  MispricingOpportunity,
  MispricingSignal,
  PaperTradeRecord,
  PolymarketDashboardData,
  PolymarketHealthReport,
  PolymarketMarket,
  RiskEventRecord,
} from "./types";
import type { CryptoPriceSnapshot } from "./types";
import type {
  BlockedSweeperRecord,
  OrderBookSnapshot,
  SweeperOpportunity,
  SweeperPaperTrade,
} from "./sweeper-types";

export interface PolymarketStoreData {
  version: 1;
  lastSuccessfulUpdate: string | null;
  errorCount: number;
  marketSnapshots: MarketSnapshotRecord[];
  latestMarkets: PolymarketMarket[];
  fairPrices: FairProbabilityResult[];
  opportunities: MispricingOpportunity[];
  signals: MispricingSignal[];
  blockedSignals: BlockedSignalRecord[];
  paperTrades: PaperTradeRecord[];
  riskEvents: RiskEventRecord[];
  cryptoSnapshots: CryptoPriceSnapshot[];
  health: PolymarketHealthReport | null;
  commentary: string[];
  orderBooks: OrderBookSnapshot[];
  sweeperOpportunities: SweeperOpportunity[];
  blockedSweeperOpportunities: BlockedSweeperRecord[];
  sweeperPaperTrades: SweeperPaperTrade[];
}

const EMPTY: PolymarketStoreData = {
  version: 1,
  lastSuccessfulUpdate: null,
  errorCount: 0,
  marketSnapshots: [],
  latestMarkets: [],
  fairPrices: [],
  opportunities: [],
  signals: [],
  blockedSignals: [],
  paperTrades: [],
  riskEvents: [],
  cryptoSnapshots: [],
  health: null,
  commentary: [],
  orderBooks: [],
  sweeperOpportunities: [],
  blockedSweeperOpportunities: [],
  sweeperPaperTrades: [],
};

function defaultStoreDir(): string {
  if (process.env.POLYMARKET_DATA_DIR?.trim()) {
    return process.env.POLYMARKET_DATA_DIR.trim();
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "polymarket");
  }
  return path.join(process.cwd(), "data", "polymarket");
}

function storePath(): string {
  return path.join(defaultStoreDir(), "polymarket-store.json");
}

function ensureDir(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

export function readPolymarketStore(): PolymarketStoreData {
  const file = storePath();
  if (!fs.existsSync(file)) return { ...EMPTY };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as PolymarketStoreData;
    return { ...EMPTY, ...raw, version: 1 };
  } catch {
    return { ...EMPTY, errorCount: 1 };
  }
}

export function writePolymarketStore(data: PolymarketStoreData): void {
  const file = storePath();
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function appendPolymarketStore(update: Partial<PolymarketStoreData>): PolymarketStoreData {
  const current = readPolymarketStore();
  const next: PolymarketStoreData = {
    ...current,
    ...update,
    signals: update.signals ?? current.signals,
    blockedSignals: update.blockedSignals
      ? [...current.blockedSignals, ...update.blockedSignals].slice(-500)
      : current.blockedSignals,
    paperTrades: update.paperTrades
      ? [...current.paperTrades, ...update.paperTrades].slice(-500)
      : current.paperTrades,
    riskEvents: update.riskEvents
      ? [...current.riskEvents, ...update.riskEvents].slice(-500)
      : current.riskEvents,
    marketSnapshots: update.marketSnapshots
      ? [...current.marketSnapshots, ...update.marketSnapshots].slice(-100)
      : current.marketSnapshots,
    commentary: update.commentary ?? current.commentary,
    orderBooks: update.orderBooks ?? current.orderBooks,
    sweeperOpportunities: update.sweeperOpportunities ?? current.sweeperOpportunities,
    blockedSweeperOpportunities: update.blockedSweeperOpportunities
      ? [...current.blockedSweeperOpportunities, ...update.blockedSweeperOpportunities].slice(-500)
      : current.blockedSweeperOpportunities,
    sweeperPaperTrades: update.sweeperPaperTrades
      ? [...current.sweeperPaperTrades, ...update.sweeperPaperTrades].slice(-500)
      : current.sweeperPaperTrades,
  };
  writePolymarketStore(next);
  return next;
}

export function buildDashboardData(store: PolymarketStoreData): PolymarketDashboardData {
  return {
    markets: store.latestMarkets,
    fairPrices: store.fairPrices,
    opportunities: store.opportunities,
    signals: store.signals.filter((s) => s.status === "OPEN" || s.status === "EXECUTED"),
    blockedSignals: store.blockedSignals.slice(-50).reverse(),
    paperTrades: store.paperTrades.slice(-50).reverse(),
    riskEvents: store.riskEvents.slice(-50).reverse(),
    cryptoSnapshots: store.cryptoSnapshots,
    health:
      store.health ?? {
        status: "WARNING",
        polymarketDataFresh: false,
        cryptoDataFresh: false,
        fairPriceEngineOk: false,
        paperSimulatorOk: false,
        riskManagerOk: false,
        killSwitchActive: false,
        lastSuccessfulUpdate: null,
        errorCount: store.errorCount,
        messages: ["No cycle run yet."],
        realTradingEnabled: false,
        paperTradingEnabled: true,
      },
    commentary: store.commentary.slice(-20),
    orderBooks: store.orderBooks,
    sweeperOpportunities: store.sweeperOpportunities.slice(-50).reverse(),
    blockedSweeperOpportunities: store.blockedSweeperOpportunities.slice(-50).reverse(),
    sweeperPaperTrades: store.sweeperPaperTrades.slice(-50).reverse(),
  };
}

export function resetPolymarketStoreForTests(): void {
  writePolymarketStore({ ...EMPTY });
}
