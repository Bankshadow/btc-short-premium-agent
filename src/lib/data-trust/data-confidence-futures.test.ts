import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDataConfidence } from "./data-confidence";
import type { DataProvenanceField } from "./types";

describe("data confidence — Binance futures mode", () => {
  it("allows trade without option chain when BINANCE_TESTNET_ENABLED", () => {
    const prevEnabled = process.env.BINANCE_TESTNET_ENABLED;
    const prevProvider = process.env.MARKET_DATA_PROVIDER;
    process.env.BINANCE_TESTNET_ENABLED = "true";
    process.env.MARKET_DATA_PROVIDER = "binance";

    const provenance: DataProvenanceField[] = [
      {
        fieldName: "BTC price",
        value: 60000,
        source: "DERIVED",
        updatedAt: new Date().toISOString(),
        freshnessSeconds: 0,
        confidence: "HIGH",
      },
      {
        fieldName: "Option IV",
        value: 42,
        source: "DERIVED",
        updatedAt: new Date().toISOString(),
        freshnessSeconds: 0,
        confidence: "MEDIUM",
        issue: "Futures mode — HV proxy IV (no options chain)",
      },
      {
        fieldName: "Option delta",
        value: null,
        source: "DERIVED",
        updatedAt: new Date().toISOString(),
        freshnessSeconds: 0,
        confidence: "MEDIUM",
      },
    ];

    const result = computeDataConfidence(provenance);
    assert.equal(result.tradeAllowed, true);
    assert.notEqual(result.grade, "CRITICAL");

    process.env.BINANCE_TESTNET_ENABLED = prevEnabled;
    process.env.MARKET_DATA_PROVIDER = prevProvider;
  });
});
