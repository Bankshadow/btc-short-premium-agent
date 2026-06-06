import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustScaledNotionalUsd } from "./trust-scaled-notional";

test("trust-scaled notional floors at exchange minimum", () => {
  const n = resolveTrustScaledNotionalUsd({
    completedTrades: 0,
    minRequired: 12,
    maxNotionalUsd: 55,
  });
  assert.equal(n, 50);
});

test("trust-scaled notional reaches max when trust ready", () => {
  const n = resolveTrustScaledNotionalUsd({
    completedTrades: 12,
    minRequired: 12,
    maxNotionalUsd: 55,
  });
  assert.equal(n, 55);
});
