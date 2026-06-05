import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregatePortfolioGreeks } from "./aggregate-portfolio";
import { buildGreekSnapshots } from "./build-positions";
import { buildOptionsRiskReport, buildStressTestReport } from "./build-options-risk-report";
import { estimatePositionGreeks } from "./estimate-greeks";
import { estimatePortfolioMargin } from "./estimate-margin";
import { runOptionsPortfolioRiskChecks } from "./risk-checks";
import { runStressScenarios } from "./stress-test";
import { buildOptionsLiveReadinessReport } from "@/lib/options-execution/options-readiness";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

function basePreview(): OptionsOrderPreview {
  return {
    previewId: "p-risk-1",
    valid: true,
    previewOnly: true,
    realExecutionDisabled: true,
    ticket: {
      ticketId: "t1",
      decisionLogId: "dl1",
      instrument: "sell_call",
      optionsInstrument: {
        symbol: "BTC-28MAR25-65000-C",
        base: "BTC",
        strike: 65000,
        expiry: "28MAR25",
        expiryTimeMs: Date.now() + 86400000 * 3,
        optionType: "call",
        bid: 100,
        ask: 105,
        markPrice: 102,
        spreadPct: 4.9,
        delta: 0.14,
        iv: 32,
        mapped: true,
        mappingErrors: [],
      },
      side: "short",
      contracts: 2,
      limitPrice: 102,
      notionalUsd: 204,
      positionSizePct: 1,
      stopLossIndex: 68000,
      takeProfitIndex: 90,
      generatedAt: new Date().toISOString(),
      sourceTicket: {
        id: "t1",
        decisionLogId: "dl1",
        instrument: "sell_call",
        symbol: "BTC-28MAR25-65000-C",
        side: "short",
        entryPrice: 60000,
        positionSizePct: 1,
        stopLoss: 68000,
        takeProfit: 90,
        strike: 65000,
        entryOptionMark: 102,
      },
    },
    estimatedPremiumUsd: 204,
    estimatedMaxLossUsd: 800,
    estimatedBreakevenIndex: 65102,
    margin: {
      estimatedMarginUsd: 245,
      marginUsagePct: 12,
      availableBalanceUsd: 2000,
      sufficient: true,
    },
    expiryPlan: {
      expiryDate: "28MAR25",
      expiryTimeMs: Date.now() + 86400000 * 3,
      hoursToExpiry: 72,
      settlementTimeTh: "16:00",
      pinExitTimeTh: "15:00",
      proximityWarning: false,
    },
    assignmentRisk: "low",
    settlementRisk: "cash",
    liquidityRisk: "ok",
    slippageRisk: "ok",
    riskChecks: [],
    blockingReasons: [],
    warnings: [],
    bybitPayload: { symbol: "BTC-28MAR25-65000-C", qty: "2" },
    disclaimer: "test",
    generatedAt: new Date().toISOString(),
  };
}

function baseDryRun(): OptionsDryRunResult {
  const preview = basePreview();
  return {
    dryRunId: "odr-test-1",
    decisionLogId: "dl1",
    instrument: preview.ticket!.optionsInstrument.symbol,
    side: "short",
    qty: 2,
    premium: 204,
    bidAskSpread: 4.9,
    estimatedMargin: 245,
    delta: -0.28,
    gamma: 0.0001,
    theta: -0.5,
    vega: 12,
    riskStatus: "PASS",
    wouldSubmit: true,
    rejectionReasons: [],
    createdAt: new Date().toISOString(),
    preview,
    realTimeRisk: null,
    simulatedExchangeDecision: "accept",
    dryRunOnly: true,
    noRealOrders: true,
    cannotEnableLive: true,
    disclaimer: "test",
    rejectionCategory: null,
    playbookAction: "sell_call",
  };
}

function openPaperOrder(): PaperOrder {
  return {
    id: "po-1",
    decisionLogId: "dl1",
    committeeVerdict: "TRADE",
    instrument: "sell_call",
    symbol: "BTC-PAPER-C",
    side: "short",
    status: "OPEN",
    entryBtcPrice: 60000,
    notionalUsd: 150,
    strike: 64000,
    entryOptionMark: 75,
    sizePct: 1,
    openedAt: new Date().toISOString(),
    closedAt: null,
    exitBtcPrice: null,
    realizedPnlPct: null,
    unrealizedPnlPct: null,
    lastMarkAt: null,
    lastMarkBtcPrice: null,
    openedBy: "manual",
    notes: "test",
  };
}

describe("options risk greeks MVP 45", () => {
  it("estimates position Greeks from instrument delta", () => {
    const g = estimatePositionGreeks({
      delta: 0.14,
      iv: 32,
      markPrice: 102,
      spotPrice: 60000,
      hoursToExpiry: 48,
      contracts: 2,
      side: "short",
    });
    assert.ok(g.estimable);
    assert.ok(g.delta < 0);
    assert.ok(g.theta !== 0);
    assert.ok(g.vega !== 0);
  });

  it("builds portfolio snapshots from paper, dry-run, and preview", () => {
    const positions = buildGreekSnapshots({
      paperOrders: [openPaperOrder()],
      dryRunResults: [baseDryRun()],
      preview: basePreview(),
      spotPrice: 60000,
      walletBalanceUsd: 2000,
    });
    assert.ok(positions.length >= 3);
    const portfolio = aggregatePortfolioGreeks(positions);
    assert.equal(portfolio.positionCount, positions.length);
    assert.ok(portfolio.byExpiry.length > 0);
    assert.ok(portfolio.byStrike.length > 0);
  });

  it("produces full risk report with margin and stress scenarios", () => {
    const report = buildOptionsRiskReport({
      paperOrders: [openPaperOrder()],
      dryRunResults: [baseDryRun()],
      spotPrice: 60000,
      walletBalanceUsd: 2000,
    });
    assert.ok(report.portfolio.positionCount > 0);
    assert.equal(report.greeksEstimable, true);
    assert.equal(report.marginEstimable, true);
    assert.ok(report.stressScenarios.length > 0);
    assert.equal(report.cannotPlaceOrders, true);
    assert.ok(report.checks.some((c) => c.id === "greeks_estimable"));
    assert.ok(report.checks.some((c) => c.id === "margin_estimable"));
  });

  it("blocks live readiness when Greeks cannot be estimated", () => {
    const report = buildOptionsRiskReport({
      preview: {
        ...basePreview(),
        ticket: {
          ...basePreview().ticket!,
          optionsInstrument: {
            ...basePreview().ticket!.optionsInstrument,
            mapped: false,
            delta: 0,
            iv: 0,
            markPrice: 0,
          },
        },
      },
      spotPrice: 60000,
      walletBalanceUsd: 2000,
    });
    assert.equal(report.greeksEstimable, false);
    assert.equal(report.liveReadinessBlocked, true);

    const readiness = buildOptionsLiveReadinessReport({ optionsRiskReport: report });
    assert.equal(readiness.overallStatus, "FAIL");
    assert.ok(
      readiness.checks.some(
        (c) => c.label === "Portfolio Greeks estimable" && c.status === "FAIL",
      ),
    );
  });

  it("blocks live readiness when margin cannot be estimated", () => {
    const report = buildOptionsRiskReport({
      dryRunResults: [baseDryRun()],
      spotPrice: 60000,
      walletBalanceUsd: null,
    });
    assert.equal(report.marginEstimable, false);
    assert.equal(report.liveReadinessBlocked, true);

    const readiness = buildOptionsLiveReadinessReport({ optionsRiskReport: report });
    assert.equal(readiness.overallStatus, "FAIL");
    assert.ok(readiness.optionsRiskGate?.marginEstimable === false);
  });

  it("runs custom stress test scenarios", () => {
    const positions = buildGreekSnapshots({
      dryRunResults: [baseDryRun()],
      spotPrice: 60000,
    });
    const stressed = buildStressTestReport({
      dryRunResults: [baseDryRun()],
      spotPrice: 60000,
      walletBalanceUsd: 2000,
      priceMovesPct: [-20, 20],
      volExpansionPct: [100],
    });
    assert.ok(stressed.stressScenarios.some((s) => s.type === "price_move"));
    assert.ok(stressed.stressScenarios.some((s) => s.type === "vol_expansion"));

    const scenarios = runStressScenarios({
      positions,
      spotPrice: 60000,
      priceMovesPct: [10],
      volExpansionPct: [],
    });
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0]?.type, "price_move");
  });

  it("flags max delta exposure in risk checks", () => {
    const positions = buildGreekSnapshots({
      dryRunResults: [
        {
          ...baseDryRun(),
          delta: -0.5,
          qty: 10,
          premium: 1000,
        },
      ],
      spotPrice: 60000,
    });
    const portfolio = aggregatePortfolioGreeks(positions);
    const margin = estimatePortfolioMargin({ positions, walletBalanceUsd: 5000 });
    const checks = runOptionsPortfolioRiskChecks({
      portfolio,
      margin,
      spotPrice: 60000,
      greeksEstimable: true,
      marginEstimable: true,
    });
    assert.ok(checks.some((c) => c.id === "max_delta"));
  });

  it("fails readiness when risk report is missing", () => {
    const readiness = buildOptionsLiveReadinessReport();
    assert.equal(readiness.overallStatus, "FAIL");
    assert.equal(readiness.optionsRiskGate, null);
    assert.ok(
      readiness.checks.some(
        (c) => c.label === "Portfolio margin estimable" && c.status === "FAIL",
      ),
    );
  });
});
