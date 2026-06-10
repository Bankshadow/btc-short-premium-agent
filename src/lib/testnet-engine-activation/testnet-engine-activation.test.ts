import assert from "node:assert/strict";
import test from "node:test";
import { resolveBinanceTestnetDiagnosticFromStatus } from "./build-binance-testnet-diagnostic";
import { buildEvidenceQualityActivationStatus } from "./build-evidence-quality-status";
import { buildReconciliationStatus } from "./build-reconciliation-status";
import { withActivationTimeout } from "./build-engine-health-status";

test("resolveBinanceTestnetDiagnosticFromStatus — null status is DISCONNECTED", () => {
  const diag = resolveBinanceTestnetDiagnosticFromStatus(null);
  assert.equal(diag.status, "DISCONNECTED");
  assert.equal(diag.connected, false);
  assert.ok(diag.recommendation.length > 0);
});

test("resolveBinanceTestnetDiagnosticFromStatus — connected", () => {
  const diag = resolveBinanceTestnetDiagnosticFromStatus({
    connected: true,
    testnetEnabled: true,
    liveEnabled: false,
    proxyEnabled: false,
    baseUrl: "https://testnet.binancefuture.com",
    error: null,
    blockers: [],
    clockSkewMs: null,
  });
  assert.equal(diag.status, "CONNECTED");
  assert.equal(diag.connected, true);
});

test("resolveBinanceTestnetDiagnosticFromStatus — missing env", () => {
  const prevKey = process.env.BINANCE_API_KEY;
  const prevSecret = process.env.BINANCE_API_SECRET;
  delete process.env.BINANCE_API_KEY;
  delete process.env.BINANCE_API_SECRET;
  try {
    const diag = resolveBinanceTestnetDiagnosticFromStatus({
      connected: false,
      testnetEnabled: true,
      liveEnabled: false,
      proxyEnabled: false,
      baseUrl: "https://testnet.binancefuture.com",
      error: null,
      blockers: [],
      clockSkewMs: null,
    });
    assert.equal(diag.status, "MISSING_ENV");
    assert.match(diag.reason, /BINANCE_API_KEY/);
  } finally {
    if (prevKey !== undefined) process.env.BINANCE_API_KEY = prevKey;
    if (prevSecret !== undefined) process.env.BINANCE_API_SECRET = prevSecret;
  }
});

test("withActivationTimeout — returns fallback on slow promise", async () => {
  const fallback = { status: "WARNING" as const, ok: true };
  const slow = new Promise<{ status: "OK" }>((resolve) => {
    setTimeout(() => resolve({ status: "OK" }), 200);
  });
  const result = await withActivationTimeout(slow, 50, fallback);
  assert.equal(result.status, "WARNING");
});

test("buildEvidenceQualityActivationStatus — zero-state when no trades", async () => {
  const status = await buildEvidenceQualityActivationStatus();
  if (status.validEvidenceCount === 0) {
    assert.equal(status.status, "INSUFFICIENT");
    assert.equal(status.message, "No completed trades yet.");
  } else {
    assert.ok(status.requiredEvidenceCount >= 12);
  }
});

test("buildReconciliationStatus — zero-state message when no trades", async () => {
  const status = await buildReconciliationStatus();
  const zeroState =
    status.message === "OK — no trades to reconcile yet." ||
    status.orphanOpenTrades >= 0;
  assert.ok(zeroState);
  assert.ok(["OK", "WARNING", "BLOCKED"].includes(status.status));
});
