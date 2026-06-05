import { blockProductionOptionsOrder } from "@/lib/options-execution/testnet-gates";
import { loadOptionsExecutionConfig } from "@/lib/options-execution/config";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";
import type { RealTimeRiskReport } from "@/lib/real-time-risk/types";

export interface SimulatedExchangeResult {
  decision: "ACCEPT" | "REJECT";
  wouldSubmit: boolean;
  rejectionReasons: string[];
  rejectionCategory:
    | "liquidity"
    | "margin"
    | "governance"
    | "risk_engine"
    | "mapping"
    | "production_block"
    | "other"
    | null;
}

function categorize(reason: string): SimulatedExchangeResult["rejectionCategory"] {
  const r = reason.toLowerCase();
  if (r.includes("liquidity") || r.includes("spread") || r.includes("bid/ask")) {
    return "liquidity";
  }
  if (r.includes("margin") || r.includes("balance") || r.includes("notional")) {
    return "margin";
  }
  if (r.includes("governance") || r.includes("pause") || r.includes("incident")) {
    return "governance";
  }
  if (r.includes("real-time risk") || r.includes("kill switch") || r.includes("risk budget")) {
    return "risk_engine";
  }
  if (r.includes("mapping") || r.includes("parse") || r.includes("symbol")) {
    return "mapping";
  }
  if (r.includes("production") || r.includes("not implemented") || r.includes("live")) {
    return "production_block";
  }
  return "other";
}

export function simulateExchangeAcceptReject(input: {
  preview: OptionsOrderPreview;
  realTimeRisk?: RealTimeRiskReport | null;
}): SimulatedExchangeResult {
  const reasons: string[] = [];
  const { preview } = input;

  const productionBlock = blockProductionOptionsOrder();
  if (productionBlock) {
    reasons.push(productionBlock);
  }

  const config = loadOptionsExecutionConfig();
  if (!config.nakedAllowed && preview.ticket?.side === "short") {
    reasons.push("OPTIONS_NAKED_ALLOWED is false — short premium blocked.");
  }

  if (!preview.valid) {
    reasons.push(...preview.blockingReasons);
  }

  if (preview.margin.sufficient === false) {
    reasons.push("Insufficient margin / balance for estimated premium.");
  }

  if (preview.liquidityRisk.toLowerCase().includes("wide")) {
    reasons.push(preview.liquidityRisk);
  }

  const rt = input.realTimeRisk;
  if (rt?.blockNewTrades) {
    reasons.push(`Real-time risk ${rt.riskStatus} — would block live submit.`);
  }

  for (const check of preview.riskChecks) {
    if (check.blocking && !reasons.includes(check.message)) {
      reasons.push(check.message);
    }
  }

  if (!preview.bybitPayload) {
    reasons.push("Missing Bybit payload — exchange would reject.");
  }

  const unique = [...new Set(reasons)];
  const wouldSubmit = unique.length === 0;
  const primaryCategory = unique.length > 0 ? categorize(unique[0]) : null;

  return {
    decision: wouldSubmit ? "ACCEPT" : "REJECT",
    wouldSubmit,
    rejectionReasons: unique,
    rejectionCategory: primaryCategory,
  };
}
