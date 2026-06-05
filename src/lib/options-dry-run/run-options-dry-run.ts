import { buildOptionsOrderPreview } from "@/lib/options-execution/build-options-preview";
import { enrichRealTimeRiskInput, evaluateRealTimeRisk } from "@/lib/real-time-risk";
import { buildOrderTicket } from "@/lib/trade-control/build-order-ticket";
import { estimateOptionsGreeks } from "./estimate-greeks";
import { fetchLiveOptionQuote } from "./fetch-live-quote";
import { simulateExchangeAcceptReject } from "./simulate-exchange";
import type {
  OptionsDryRunInput,
  OptionsDryRunResult,
  OptionsDryRunRiskStatus,
} from "./types";
import { OPTIONS_DRY_RUN_SAFETY_NOTICE } from "./types";

function newDryRunId(): string {
  return `odr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveRiskStatus(
  previewValid: boolean,
  wouldSubmit: boolean,
  warnings: number,
): OptionsDryRunRiskStatus {
  if (!previewValid || !wouldSubmit) return "FAIL";
  if (warnings > 0) return "WARNING";
  return "PASS";
}

export async function runOptionsDryRun(
  input: OptionsDryRunInput,
): Promise<OptionsDryRunResult> {
  let ticket = input.ticket;
  if (!ticket && input.data && input.decisionLogId) {
    ticket = buildOrderTicket(input.data, input.decisionLogId) ?? undefined;
  }
  if (!ticket) {
    throw new Error("Order ticket or analyze data with decisionLogId required.");
  }

  const quote = await fetchLiveOptionQuote({
    ticket,
    candidate: input.candidate,
  });

  const riskInput = await enrichRealTimeRiskInput({
    entries: input.entries ?? [],
    orders: input.orders ?? [],
    governance: input.governance,
    incidents: input.incidents,
    market: input.data ?? null,
  });
  const realTimeRisk = evaluateRealTimeRisk(riskInput);

  const preview = await buildOptionsOrderPreview({
    ticket,
    data: input.data,
    candidate: quote.candidate ?? input.candidate,
    entries: input.entries,
    orders: input.orders,
    governance: input.governance,
    incidents: input.incidents,
    journal: input.journal,
    realTimeRiskReport: realTimeRisk,
  });

  if (quote.quoteError && !quote.candidate) {
    preview.blockingReasons.push(quote.quoteError);
    preview.valid = false;
  }

  const greeks = estimateOptionsGreeks({
    instrument: preview.ticket?.optionsInstrument ?? null,
    candidate: quote.candidate ?? input.candidate,
    spotPrice: input.data?.step1_marketSnapshot.spotPrice,
    hoursToExpiry: preview.expiryPlan?.hoursToExpiry,
    contracts: preview.ticket?.contracts ?? 1,
    side: preview.ticket?.side ?? "short",
  });

  const simulated = simulateExchangeAcceptReject({ preview, realTimeRisk });
  const spread =
    preview.ticket?.optionsInstrument.spreadPct ??
    (preview.ticket
      ? Number(
          (
            ((preview.ticket.optionsInstrument.ask -
              preview.ticket.optionsInstrument.bid) /
              Math.max(preview.ticket.optionsInstrument.markPrice, 0.01)) *
            100
          ).toFixed(2),
        )
      : 0);

  const warnings = preview.warnings.length + (realTimeRisk.riskStatus === "CAUTION" ? 1 : 0);

  return {
    dryRunId: newDryRunId(),
    decisionLogId: ticket.decisionLogId,
    instrument: preview.ticket?.optionsInstrument.symbol ?? ticket.symbol,
    side: preview.ticket?.side ?? "short",
    qty: preview.ticket?.contracts ?? 0,
    premium: preview.estimatedPremiumUsd,
    bidAskSpread: spread,
    estimatedMargin: preview.margin.estimatedMarginUsd,
    delta: greeks.delta,
    gamma: greeks.gamma,
    theta: greeks.theta,
    vega: greeks.vega,
    riskStatus: resolveRiskStatus(preview.valid, simulated.wouldSubmit, warnings),
    wouldSubmit: simulated.wouldSubmit,
    rejectionReasons: simulated.rejectionReasons,
    createdAt: new Date().toISOString(),
    preview,
    realTimeRisk,
    simulatedExchangeDecision: simulated.decision,
    dryRunOnly: true,
    noRealOrders: true,
    cannotEnableLive: true,
    disclaimer: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    rejectionCategory: simulated.rejectionCategory,
    playbookAction: ticket.instrument,
  };
}
