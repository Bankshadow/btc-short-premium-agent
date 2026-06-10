import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import {
  DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  MISSING_BINANCE_CREDENTIALS_REASON,
  MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
  resolveTestnetBaseUrl,
} from "@/lib/execution/binance-testnet-config";
import { getBinanceTestnetStatus } from "@/lib/execution/binance-testnet-status";

describe("MVP 4.5 settings testnet config", () => {
  let prevBaseUrl: string | undefined;
  let prevKey: string | undefined;
  let prevSecret: string | undefined;
  let prevTestnet: string | undefined;

  before(() => {
    prevBaseUrl = process.env.BINANCE_FUTURES_TESTNET_BASE_URL;
    prevKey = process.env.BINANCE_API_KEY;
    prevSecret = process.env.BINANCE_API_SECRET;
    prevTestnet = process.env.BINANCE_TESTNET_ENABLED;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.BINANCE_LIVE_ENABLED = "false";
  });

  after(() => {
    if (prevBaseUrl !== undefined) process.env.BINANCE_FUTURES_TESTNET_BASE_URL = prevBaseUrl;
    else delete process.env.BINANCE_FUTURES_TESTNET_BASE_URL;
    if (prevKey !== undefined) process.env.BINANCE_API_KEY = prevKey;
    else delete process.env.BINANCE_API_KEY;
    if (prevSecret !== undefined) process.env.BINANCE_API_SECRET = prevSecret;
    else delete process.env.BINANCE_API_SECRET;
    if (prevTestnet !== undefined) process.env.BINANCE_TESTNET_ENABLED = prevTestnet;
    else delete process.env.BINANCE_TESTNET_ENABLED;
  });

  it("defaults baseUrl when env missing", () => {
    delete process.env.BINANCE_FUTURES_TESTNET_BASE_URL;
    assert.equal(resolveTestnetBaseUrl(), DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL);
  });

  it("returns MISSING_ENV with clear reason when credentials missing", async () => {
    delete process.env.BINANCE_API_KEY;
    delete process.env.BINANCE_API_SECRET;
    const status = await getBinanceTestnetStatus();
    assert.equal(status.status, "MISSING_ENV");
    assert.equal(status.reason, MISSING_BINANCE_CREDENTIALS_REASON);
    assert.equal(status.recommendation, MISSING_BINANCE_CREDENTIALS_RECOMMENDATION);
    assert.equal(status.baseUrl, DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL);
    assert.equal(status.apiKeyPresent, false);
    assert.equal(status.apiSecretPresent, false);
  });

  it("normalize diagnostics always includes baseUrl and live locked flags", async () => {
    delete process.env.BINANCE_API_KEY;
    delete process.env.BINANCE_API_SECRET;
    const normalized = normalizeBinanceStatusDiagnostics(await getBinanceTestnetStatus());
    assert.ok(normalized.baseUrl.length > 0);
    assert.equal(normalized.liveLocked, true);
    assert.equal(normalized.manualExecuteOnly, true);
    assert.equal(normalized.autoExecuteEnabled, false);
    assert.equal(normalized.connected, false);
  });
});
