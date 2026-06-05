import type { AnalyzeApiResponse, OptionCandidate } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import { mapOrderTicketToOptionOrder } from "@/lib/exchange/instrument-mapper";
import { resolvePreviewNotionalUsd } from "@/lib/exchange/instrument-mapper";
import { resolveExchangeCredentials } from "@/lib/exchange/exchange-config";
import { fetchWalletSnapshot } from "@/lib/exchange/wallet";
import { OPTIONS_SAFETY_NOTICE } from "./config";
import { capOrderTicketWithRiskBudget } from "@/lib/risk-budget-optimizer/apply-risk-budget";
import { mapPlaybookToOptionsInstrument } from "./map-instrument";
import { runOptionsRiskChecks, summarizeRiskChecks } from "./risk-checks";
import type {
  OptionsExpiryPlan,
  OptionsMarginEstimate,
  OptionsOrderPreview,
  OptionsOrderTicket,
  OptionsPreviewJournalEntry,
} from "./types";

async function resolveBalance(): Promise<number | null> {
  const creds = resolveExchangeCredentials();
  if (!creds) return null;
  try {
    const wallet = await fetchWalletSnapshot(creds);
    const usdt = wallet?.coins.find((c) => c.coin === "USDT");
    return usdt?.availableBalance ?? wallet?.totalEquityUsd ?? null;
  } catch {
    return null;
  }
}

function buildExpiryPlan(
  instrument: { expiry: string; expiryTimeMs: number },
  actionPlan?: AnalyzeApiResponse["step6_actionPlan"],
): OptionsExpiryPlan {
  const hoursToExpiry = Math.max(
    0,
    (instrument.expiryTimeMs - Date.now()) / (60 * 60 * 1000),
  );
  return {
    expiryDate: instrument.expiry,
    expiryTimeMs: instrument.expiryTimeMs,
    hoursToExpiry: Number(hoursToExpiry.toFixed(2)),
    settlementTimeTh: actionPlan?.settlementTimeTh ?? "15:00",
    pinExitTimeTh: actionPlan?.pinExitTimeTh ?? "13:30",
    proximityWarning: hoursToExpiry < 8,
  };
}

function estimateBreakeven(
  spot: number,
  strike: number,
  premium: number,
  action: OrderTicket["instrument"],
): number | null {
  if (action === "sell_call") return strike + premium;
  if (action === "sell_put") return strike - premium;
  return spot;
}

export async function buildOptionsOrderPreview(input: {
  ticket: OrderTicket;
  data?: AnalyzeApiResponse | null;
  candidate?: OptionCandidate | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  journal?: OptionsPreviewJournalEntry[];
  paperOrders?: PaperOrder[];
  realTimeRiskReport?: import("@/lib/real-time-risk/types").RealTimeRiskReport | null;
}): Promise<OptionsOrderPreview> {
  const previewId = `opt-preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const candidate =
    input.candidate ?? input.data?.step5_verdict.candidate ?? null;

  const ticket = capOrderTicketWithRiskBudget(
    input.ticket,
    input.data?.riskBudget,
  );

  const { instrument, errors } = mapPlaybookToOptionsInstrument(
    ticket,
    candidate,
  );

  const balance = await resolveBalance();
  const notionalUsd = resolvePreviewNotionalUsd(
    ticket.positionSizePct,
    balance ?? 0,
  );
  const mapped = mapOrderTicketToOptionOrder(ticket, notionalUsd);
  const contracts = mapped ? Number(mapped.qty) : 0;
  const limitPrice = mapped ? Number(mapped.price) : candidate?.markPrice ?? 0;
  const premiumUsd = Number((contracts * limitPrice).toFixed(2));

  const marginEstimate: OptionsMarginEstimate = {
    estimatedMarginUsd: Number((premiumUsd * 1.2).toFixed(2)),
    marginUsagePct:
      balance && balance > 0
        ? Number(((premiumUsd / balance) * 100).toFixed(1))
        : null,
    availableBalanceUsd: balance,
    sufficient: balance === null ? null : premiumUsd <= balance,
  };

  const optionsTicket: OptionsOrderTicket | null = instrument
    ? {
        ticketId: ticket.id,
        decisionLogId: ticket.decisionLogId,
        instrument: ticket.instrument,
        optionsInstrument: instrument,
        side: "short",
        contracts,
        limitPrice,
        notionalUsd: premiumUsd,
        positionSizePct: input.ticket.positionSizePct,
        stopLossIndex: ticket.stopLoss,
        takeProfitIndex: ticket.takeProfit,
        generatedAt: new Date().toISOString(),
        sourceTicket: ticket,
      }
    : null;

  const riskChecks = runOptionsRiskChecks({
    ticket: optionsTicket,
    instrument: instrument ?? null,
    margin: marginEstimate,
    data: input.data,
    entries: input.entries,
    orders: input.orders,
    governance: input.governance,
    incidents: input.incidents,
    journal: input.journal,
    preMortem: input.data?.preMortem ?? null,
    realTimeRiskReport: input.realTimeRiskReport ?? null,
  });

  if (errors.length > 0) {
    riskChecks.unshift({
      id: "mapping_errors",
      label: "Instrument validation",
      status: "FAIL",
      message: errors.join("; "),
      blocking: true,
    });
  }

  const summary = summarizeRiskChecks(riskChecks);
  const spot = input.data?.step1_marketSnapshot.spotPrice ?? input.ticket.entryPrice;

  const maxLossUsd = Number((premiumUsd * 3 + spot * 0.02 * contracts).toFixed(2));

  return {
    previewId,
    valid: summary.valid && instrument !== null && contracts >= 1,
    previewOnly: true,
    realExecutionDisabled: true,
    ticket: optionsTicket,
    estimatedPremiumUsd: premiumUsd,
    estimatedMaxLossUsd: maxLossUsd,
    estimatedBreakevenIndex: instrument
      ? estimateBreakeven(
          spot,
          instrument.strike,
          limitPrice,
          input.ticket.instrument,
        )
      : null,
    margin: marginEstimate,
    expiryPlan: instrument ? buildExpiryPlan(instrument, input.data?.step6_actionPlan) : null,
    assignmentRisk:
      input.ticket.instrument === "sell_put"
        ? "Short put — assignment if BTC drops below strike at expiry."
        : "Short call — assignment if BTC rises above strike at expiry.",
    settlementRisk: "Daily 08:00 UTC settlement — pin risk near expiry.",
    liquidityRisk:
      instrument && instrument.spreadPct > 8
        ? `Wide spread ${instrument.spreadPct}% — limit fill uncertainty.`
        : "Mark/bid/ask within normal desk range.",
    slippageRisk: `Limit sell at mark $${limitPrice} — may not fill if mark moves.`,
    riskChecks,
    blockingReasons: summary.blockingReasons,
    warnings: summary.warnings,
    bybitPayload: mapped ? (mapped as unknown as Record<string, unknown>) : null,
    disclaimer: OPTIONS_SAFETY_NOTICE,
    generatedAt: new Date().toISOString(),
  };
}

export function linkPaperOrderToPreview(
  preview: OptionsOrderPreview,
  paperOrders: PaperOrder[],
): { linked: boolean; paperOrderId: string | null } {
  const match = paperOrders.find(
    (o) =>
      o.decisionLogId === preview.ticket?.decisionLogId &&
      o.instrument === preview.ticket?.instrument,
  );
  return { linked: Boolean(match), paperOrderId: match?.id ?? null };
}
