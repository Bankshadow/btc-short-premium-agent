import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBinanceMarketDataPreferred,
  marketDataKlineSource,
  marketDataTickerSource,
} from "./provider";

describe("market data provider", () => {
  it("prefers Binance when MARKET_DATA_PROVIDER=binance", () => {
    const prevProvider = process.env.MARKET_DATA_PROVIDER;
    const prevEnabled = process.env.BINANCE_TESTNET_ENABLED;
    process.env.MARKET_DATA_PROVIDER = "binance";
    process.env.BINANCE_TESTNET_ENABLED = "false";
    assert.equal(isBinanceMarketDataPreferred(), true);
    assert.equal(marketDataTickerSource(), "Binance Ticker");
    assert.equal(marketDataKlineSource("60"), "Binance Klines (60)");
    process.env.MARKET_DATA_PROVIDER = prevProvider;
    process.env.BINANCE_TESTNET_ENABLED = prevEnabled;
  });

  it("defaults to Binance when testnet is enabled", () => {
    const prevProvider = process.env.MARKET_DATA_PROVIDER;
    const prevEnabled = process.env.BINANCE_TESTNET_ENABLED;
    delete process.env.MARKET_DATA_PROVIDER;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    assert.equal(isBinanceMarketDataPreferred(), true);
    process.env.MARKET_DATA_PROVIDER = prevProvider;
    process.env.BINANCE_TESTNET_ENABLED = prevEnabled;
  });

  it("uses Bybit when explicitly requested", () => {
    const prevProvider = process.env.MARKET_DATA_PROVIDER;
    process.env.MARKET_DATA_PROVIDER = "bybit";
    assert.equal(isBinanceMarketDataPreferred(), false);
    assert.equal(marketDataTickerSource(), "Bybit Ticker");
    process.env.MARKET_DATA_PROVIDER = prevProvider;
  });
});
