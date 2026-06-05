import type { ExchangePositionSnapshot } from "@/lib/exchange/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";
import { OPTIONS_RISK_THRESHOLDS } from "./config";
import {
  estimateBreakeven,
  estimateMaxLoss,
  estimatePositionGreeks,
  parsePositionMeta,
} from "./estimate-greeks";
import type { OptionGreekSnapshot, OptionsRiskInput } from "./types";

function paperInstrument(
  o: PaperOrder,
): OptionGreekSnapshot["instrument"] {
  if (o.instrument === "sell_call") return "sell_call";
  if (o.instrument === "sell_put") return "sell_put";
  return "unknown";
}

export function buildGreekSnapshots(input: OptionsRiskInput): OptionGreekSnapshot[] {
  const spot = input.spotPrice ?? 60_000;
  const snapshots: OptionGreekSnapshot[] = [];

  for (const o of (input.paperOrders ?? []).filter((p) => p.status === "OPEN")) {
    if (o.instrument !== "sell_call" && o.instrument !== "sell_put") continue;
    const strike = o.strike ?? spot;
    const mark = o.entryOptionMark ?? 0;
    const contracts = Math.max(1, Math.round(o.notionalUsd / Math.max(mark, 1)));
    const greeks = estimatePositionGreeks({
      markPrice: mark,
      spotPrice: spot,
      contracts,
      side: o.side === "long" ? "long" : "short",
      delta: o.instrument === "sell_call" ? 0.14 : -0.14,
      iv: 32,
    });
    const premium = o.notionalUsd;
    const marginUsd = Number((premium * OPTIONS_RISK_THRESHOLDS.marginHaircut).toFixed(2));
    snapshots.push({
      positionId: o.id,
      source: "paper",
      symbol: o.symbol,
      instrument: paperInstrument(o),
      side: o.side === "long" ? "long" : "short",
      strike,
      expiry: "paper",
      expiryTimeMs: null,
      contracts,
      markPrice: mark,
      notionalUsd: o.notionalUsd,
      ...greeks,
      ivExposureUsd: Number((greeks.iv * premium / 100).toFixed(2)),
      breakeven: estimateBreakeven({
        strike,
        premium: mark,
        instrument: paperInstrument(o),
      }),
      maxLossApproxUsd: estimateMaxLoss({
        premiumUsd: premium,
        contracts,
        spotPrice: spot,
        instrument: paperInstrument(o),
      }),
      marginUsd,
      hoursToExpiry: null,
      spotDistancePct:
        strike > 0
          ? Number((Math.abs(spot - strike) / spot * 100).toFixed(2))
          : null,
      estimable: greeks.estimable && mark > 0,
    });
  }

  for (const p of (input.exchangePositions ?? []).filter((x) => x.size > 0)) {
    const meta = parsePositionMeta(p.symbol);
    const contracts = p.size;
    const mark = p.markPrice;
    const side = p.side === "Sell" ? "short" : "long";
    const greeks = estimatePositionGreeks({
      markPrice: mark,
      spotPrice: spot,
      contracts,
      side,
      delta: 0.15,
      iv: 30,
      hoursToExpiry: meta.expiryTimeMs
        ? (meta.expiryTimeMs - Date.now()) / 3600000
        : 48,
    });
    const notional = p.positionValueUsd;
    const marginUsd = Number((notional * OPTIONS_RISK_THRESHOLDS.marginHaircut).toFixed(2));
    const inst: OptionGreekSnapshot["instrument"] =
      meta.optionType === "call" ? "call" : meta.optionType === "put" ? "put" : "unknown";
    snapshots.push({
      positionId: `ex-${p.symbol}`,
      source: "exchange",
      symbol: p.symbol,
      instrument: inst,
      side,
      strike: meta.strike,
      expiry: meta.expiry,
      expiryTimeMs: meta.expiryTimeMs,
      contracts,
      markPrice: mark,
      notionalUsd: notional,
      ...greeks,
      ivExposureUsd: Number((greeks.iv * notional / 100).toFixed(2)),
      breakeven: null,
      maxLossApproxUsd: estimateMaxLoss({
        premiumUsd: notional,
        contracts,
        spotPrice: spot,
        instrument: inst,
      }),
      marginUsd,
      hoursToExpiry: meta.expiryTimeMs
        ? Number(((meta.expiryTimeMs - Date.now()) / 3600000).toFixed(1))
        : null,
      spotDistancePct:
        meta.strike > 0
          ? Number((Math.abs(spot - meta.strike) / spot * 100).toFixed(2))
          : null,
      estimable: greeks.estimable,
    });
  }

  for (const d of input.dryRunResults ?? []) {
    snapshots.push({
      positionId: d.dryRunId,
      source: "dry_run",
      symbol: d.instrument,
      instrument:
        d.playbookAction === "sell_put"
          ? "sell_put"
          : d.playbookAction === "sell_call"
            ? "sell_call"
            : "unknown",
      side: d.side,
      strike: d.preview.ticket?.optionsInstrument.strike ?? 0,
      expiry: d.preview.ticket?.optionsInstrument.expiry ?? "dry-run",
      expiryTimeMs: d.preview.ticket?.optionsInstrument.expiryTimeMs ?? null,
      contracts: d.qty,
      markPrice: d.premium / Math.max(d.qty, 1),
      notionalUsd: d.premium,
      delta: d.delta,
      gamma: d.gamma,
      theta: d.theta,
      vega: d.vega,
      iv: d.preview.ticket?.optionsInstrument.iv ?? 0,
      ivExposureUsd: Number(
        ((d.preview.ticket?.optionsInstrument.iv ?? 0) * d.premium) / 100,
      ),
      breakeven: d.preview.estimatedBreakevenIndex,
      maxLossApproxUsd: d.preview.estimatedMaxLossUsd,
      marginUsd: d.estimatedMargin,
      hoursToExpiry: d.preview.expiryPlan?.hoursToExpiry ?? null,
      spotDistancePct: null,
      estimable: true,
    });
  }

  if (input.preview?.ticket) {
    const t = input.preview.ticket;
    snapshots.push({
      positionId: input.preview.previewId,
      source: "preview",
      symbol: t.optionsInstrument.symbol,
      instrument:
        t.instrument === "sell_put"
          ? "sell_put"
          : t.instrument === "sell_call"
            ? "sell_call"
            : "unknown",
      side: t.side,
      strike: t.optionsInstrument.strike,
      expiry: t.optionsInstrument.expiry,
      expiryTimeMs: t.optionsInstrument.expiryTimeMs,
      contracts: t.contracts,
      markPrice: t.limitPrice,
      notionalUsd: t.notionalUsd,
      ...estimatePositionGreeks({
        instrument: t.optionsInstrument,
        spotPrice: spot,
        contracts: t.contracts,
        side: t.side,
        hoursToExpiry: input.preview.expiryPlan?.hoursToExpiry,
      }),
      ivExposureUsd: Number((t.optionsInstrument.iv * t.notionalUsd) / 100),
      breakeven: input.preview.estimatedBreakevenIndex,
      maxLossApproxUsd: input.preview.estimatedMaxLossUsd,
      marginUsd: input.preview.margin.estimatedMarginUsd,
      hoursToExpiry: input.preview.expiryPlan?.hoursToExpiry ?? null,
      spotDistancePct:
        t.optionsInstrument.strike > 0
          ? Number(
              (
                (Math.abs(spot - t.optionsInstrument.strike) / spot) *
                100
              ).toFixed(2),
            )
          : null,
      estimable: t.optionsInstrument.mapped,
    });
  }

  return snapshots;
}
