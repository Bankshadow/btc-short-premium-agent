import type { ExchangePositionSnapshot } from "@/lib/exchange/types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";

export const OPTIONS_RISK_GREEKS_SAFETY_NOTICE =
  "Portfolio margin & Greeks engine is read-only — it cannot place orders or enable live options.";

export type OptionsRiskCheckStatus = "PASS" | "WARNING" | "FAIL";

export interface OptionGreekSnapshot {
  positionId: string;
  source: "paper" | "exchange" | "dry_run" | "preview";
  symbol: string;
  instrument: "sell_call" | "sell_put" | "call" | "put" | "unknown";
  side: "short" | "long";
  strike: number;
  expiry: string;
  expiryTimeMs: number | null;
  contracts: number;
  markPrice: number;
  notionalUsd: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  ivExposureUsd: number;
  breakeven: number | null;
  maxLossApproxUsd: number;
  marginUsd: number;
  hoursToExpiry: number | null;
  spotDistancePct: number | null;
  estimable: boolean;
}

export interface PortfolioGreeks {
  netDelta: number;
  netGamma: number;
  netThetaPerDay: number;
  netVega: number;
  netIvExposureUsd: number;
  positionCount: number;
  estimablePositionCount: number;
  byPosition: OptionGreekSnapshot[];
  byExpiry: Array<{
    expiry: string;
    netDelta: number;
    netGamma: number;
    netTheta: number;
    netVega: number;
    positionCount: number;
  }>;
  byStrike: Array<{
    strike: number;
    netDelta: number;
    netGamma: number;
    positionCount: number;
  }>;
}

export interface MarginEstimate {
  totalMarginUsd: number;
  availableBalanceUsd: number | null;
  marginUsagePct: number | null;
  perPositionMarginUsd: number;
  sufficient: boolean | null;
  estimable: boolean;
}

export interface StressScenario {
  id: string;
  label: string;
  type: "price_move" | "vol_expansion" | "expiry";
  parameter: string;
  stressPnlUsd: number;
  stressPnlPct: number;
  description: string;
}

export interface OptionsRiskCheck {
  id: string;
  label: string;
  status: OptionsRiskCheckStatus;
  message: string;
  blocking: boolean;
}

export interface OptionsRiskReport {
  generatedAt: string;
  overallStatus: OptionsRiskCheckStatus;
  greeksEstimable: boolean;
  marginEstimable: boolean;
  portfolio: PortfolioGreeks;
  margin: MarginEstimate;
  stressScenarios: StressScenario[];
  checks: OptionsRiskCheck[];
  blockers: string[];
  cautions: string[];
  spotPrice: number | null;
  safetyNotice: string;
  cannotPlaceOrders: true;
  liveReadinessBlocked: boolean;
}

export interface OptionsRiskInput {
  paperOrders?: PaperOrder[];
  exchangePositions?: ExchangePositionSnapshot[];
  dryRunResults?: OptionsDryRunResult[];
  preview?: OptionsOrderPreview | null;
  spotPrice?: number | null;
  walletBalanceUsd?: number | null;
}

export interface StressTestInput extends OptionsRiskInput {
  priceMovesPct?: number[];
  volExpansionPct?: number[];
}
