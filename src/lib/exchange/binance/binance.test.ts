import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockBinanceProductionOrder,
  isBinanceTestnetBaseUrl,
  loadBinanceConfig,
  resolveBinanceEffectiveBaseUrl,
} from "./binance-config";
import { signBinanceQuery, buildSortedQueryString } from "./binance-signer";
import { validateOrderAgainstRiskGate } from "./binance-risk-gate";
import { closeSideForPosition } from "./binance-position-monitor";
import type { BinanceOrderPreview } from "./binance-types";

describe("Binance Futures Testnet", () => {
  it("blocks production base URLs", () => {
    assert.equal(isBinanceTestnetBaseUrl("https://demo-fapi.binance.com"), true);
    assert.equal(isBinanceTestnetBaseUrl("https://fapi.binance.com"), false);
  });

  it("hard-blocks when BINANCE_LIVE_ENABLED is true", () => {
    const prev = process.env.BINANCE_LIVE_ENABLED;
    process.env.BINANCE_LIVE_ENABLED = "true";
    process.env.BINANCE_FUTURES_TESTNET_BASE_URL = "https://demo-fapi.binance.com";
    const block = blockBinanceProductionOrder();
    assert.ok(block?.includes("BINANCE_LIVE_ENABLED"));
    process.env.BINANCE_LIVE_ENABLED = prev ?? "false";
  });

  it("signs query strings with HMAC SHA256", () => {
    const qs = buildSortedQueryString({ symbol: "BTCUSDT", timestamp: 123 });
    const sig = signBinanceQuery(qs, "secret");
    assert.equal(typeof sig, "string");
    assert.equal(sig.length, 64);
  });

  it("requires double confirm in risk gate", () => {
    const preview: BinanceOrderPreview = {
      previewId: "p1",
      symbol: "BTCUSDT",
      side: "SELL",
      estimatedQty: "0.001",
      notionalUsd: 10,
      markPrice: 100000,
      riskChecks: [],
      blocked: false,
      blockReasons: [],
      requiresDoubleConfirm: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      source: "manual_test",
      reason: "test",
      decisionLogId: null,
      generatedAt: new Date().toISOString(),
    };

    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_LIVE_ENABLED = "false";
    process.env.BINANCE_FUTURES_TESTNET_BASE_URL = "https://demo-fapi.binance.com";
    process.env.BINANCE_API_KEY = "k";
    process.env.BINANCE_API_SECRET = "s";

    const without = validateOrderAgainstRiskGate({ preview, doubleConfirm: false });
    assert.ok(without.blocked);
    assert.ok(without.blockReasons.some((r) => r.includes("Double confirmation")));

    const config = loadBinanceConfig();
    assert.equal(config.leverage, 1);
  });

  it("ceil-rounds qty to satisfy Binance min notional", async () => {
    const { resolveEstimatedQty } = await import("./binance-order-preview");
    const markPrice = 60_804.7;
    const qty = resolveEstimatedQty(50, markPrice, 4, 55);
    const effective = Number(qty) * markPrice;
    assert.ok(effective >= 50, `effective notional ${effective} should be >= 50`);
    assert.ok(effective <= 55, `effective notional ${effective} should be <= 55`);
  });

  it("picks reduce-only close side from position sign", () => {
    assert.equal(closeSideForPosition(0.5), "SELL");
    assert.equal(closeSideForPosition(-0.5), "BUY");
  });

  it("routes API calls through proxy URL when configured", () => {
    const prevUpstream = process.env.BINANCE_FUTURES_TESTNET_BASE_URL;
    const prevProxy = process.env.BINANCE_TESTNET_PROXY_URL;

    process.env.BINANCE_FUTURES_TESTNET_BASE_URL =
      "https://demo-fapi.binance.com";
    delete process.env.BINANCE_TESTNET_PROXY_URL;
    assert.equal(
      resolveBinanceEffectiveBaseUrl(),
      "https://demo-fapi.binance.com",
    );

    process.env.BINANCE_TESTNET_PROXY_URL = "https://proxy.example.com";
    const config = loadBinanceConfig();
    assert.equal(config.baseUrl, "https://proxy.example.com");
    assert.equal(config.upstreamBaseUrl, "https://demo-fapi.binance.com");
    assert.equal(config.proxyEnabled, true);
    assert.equal(blockBinanceProductionOrder(), null);

    process.env.BINANCE_FUTURES_TESTNET_BASE_URL = prevUpstream;
    if (prevProxy) process.env.BINANCE_TESTNET_PROXY_URL = prevProxy;
    else delete process.env.BINANCE_TESTNET_PROXY_URL;
  });
});
