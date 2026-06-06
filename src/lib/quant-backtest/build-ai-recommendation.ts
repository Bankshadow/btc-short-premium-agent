import type {
  QuantAiRecommendation,
  QuantBacktestMetrics,
  QuantLiquidityWarning,
} from "./types";

export function buildAiPaperRecommendation(input: {
  metrics: QuantBacktestMetrics;
  liquidity: QuantLiquidityWarning;
  strategyName: string;
  symbol: string;
  barsLoaded: number;
}): QuantAiRecommendation {
  const { metrics, liquidity, strategyName, symbol, barsLoaded } = input;
  const reasons: string[] = [];

  if (barsLoaded < 60) {
    return {
      verdict: "INSUFFICIENT_DATA",
      summary: `${strategyName} on ${symbol} needs more bars before paper/testnet consideration.`,
      reasons: ["Fewer than 60 candles in selected window."],
      paperTestnetAllowed: false,
      humanApprovalRequired: true,
    };
  }

  if (metrics.tradeCount < 5) {
    reasons.push(`Only ${metrics.tradeCount} trades — sample too small.`);
    return {
      verdict: "BACKTEST_MORE",
      summary: `Extend date range or tune parameters; not enough trades to judge ${strategyName}.`,
      reasons,
      paperTestnetAllowed: false,
      humanApprovalRequired: true,
    };
  }

  if (metrics.totalReturnPct <= 0) {
    reasons.push(`Net return ${metrics.totalReturnPct}% after fees/slippage.`);
  }
  if (metrics.profitFactor < 1) {
    reasons.push(`Profit factor ${metrics.profitFactor} below 1.0.`);
  }
  if (metrics.maxDrawdownPct > 15) {
    reasons.push(`Max drawdown ${metrics.maxDrawdownPct}% is elevated.`);
  }
  if (liquidity.level !== "OK") {
    reasons.push(liquidity.message);
  }

  const strong =
    metrics.totalReturnPct > 0 &&
    metrics.profitFactor >= 1.2 &&
    metrics.winRate >= 45 &&
    metrics.maxDrawdownPct <= 12 &&
    metrics.tradeCount >= 10;

  if (strong && liquidity.level !== "VERY_LOW") {
    return {
      verdict: "PAPER_WORTHY",
      summary: `${strategyName} on ${symbol} shows positive edge after friction — candidate for paper review (human approval still required).`,
      reasons: [
        `Return ${metrics.totalReturnPct}% · PF ${metrics.profitFactor} · WR ${metrics.winRate}%`,
        `Max DD ${metrics.maxDrawdownPct}% across ${metrics.tradeCount} trades.`,
        "Fees, slippage, and spread included in simulation.",
      ],
      paperTestnetAllowed: false,
      humanApprovalRequired: true,
    };
  }

  if (metrics.totalReturnPct > 0 && metrics.profitFactor >= 1) {
    return {
      verdict: "BACKTEST_MORE",
      summary: `Marginal edge on ${symbol} — run longer history or alternate timeframe before paper.`,
      reasons: reasons.length ? reasons : ["Edge is thin after friction costs."],
      paperTestnetAllowed: false,
      humanApprovalRequired: true,
    };
  }

  return {
    verdict: "REJECT",
    summary: `${strategyName} underperforms on ${symbol} after fees/slippage — not recommended for paper/testnet.`,
    reasons: reasons.length
      ? reasons
      : ["Negative expectancy after friction assumptions."],
    paperTestnetAllowed: false,
    humanApprovalRequired: true,
  };
}
