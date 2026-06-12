import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTerminalBundle, emptyTerminalBundle } from "./terminal-projection-builder";
import type { TerminalBundle } from "./terminal-types";

function assertBundleShape(bundle: TerminalBundle): void {
  assert.equal(bundle.meta.paperOnly, true);
  assert.equal(bundle.meta.realTradingEnabled, false);
  assert.equal(bundle.meta.liveLocked, true);
  assert.equal(bundle.configPanel.realTradingEnabled, false);
  assert.equal(bundle.agentDebate.advisoryOnly, true);
  assert.ok(Array.isArray(bundle.polymarketMispricing));
  assert.ok(Array.isArray(bundle.sweeperScanner));
  assert.ok(Array.isArray(bundle.riskGuard));
  assert.ok(Array.isArray(bundle.paperBlotter));
  assert.ok(Array.isArray(bundle.decisionJournal));
  assert.ok(typeof bundle.commandCenter.btcRegime === "string");
  assert.ok(bundle.marketData.btc);
  assert.ok(bundle.marketData.eth);
}

describe("MVP 22 terminal bundle", () => {
  it("empty bundle satisfies safety invariants", () => {
    assertBundleShape(emptyTerminalBundle());
  });

  it("buildTerminalBundle returns valid shape", async () => {
    const bundle = await buildTerminalBundle();
    assertBundleShape(bundle);
    assert.ok(bundle.meta.builtAt.length > 0);
  });

  it("config panel never enables real trading", async () => {
    const bundle = await buildTerminalBundle();
    assert.equal(bundle.configPanel.realTradingEnabled, false);
  });
});
