import { normalizeBinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { getKillSwitchState } from "@/lib/execution/kill-switch-state";
import { hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import {
  allowedPreviewSymbols,
  maxPreviewNotionalUsd,
  RISK_POLICY,
} from "@/lib/risk/risk-gate";
import { API_RESPONSE_BOUND_MS, zeroBinanceStatusApiResponse } from "@/lib/core/zero-state";
import { projectionApiFail, projectionApiOk } from "@/lib/core/projection-api-response";

export async function GET() {
  try {
    const status = normalizeBinanceStatusDiagnostics(
      await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS),
      "mvp-4.6",
    );

    await hydrateOperatorGateState();
    const killSwitch = getKillSwitchState();

    return projectionApiOk({
      ...status,
      killSwitch,
      limits: {
        maxNotionalUsd: maxPreviewNotionalUsd(),
        allowedSymbols: allowedPreviewSymbols(),
      },
      riskPolicy: RISK_POLICY,
    });
  } catch (err) {
    return projectionApiFail(
      zeroBinanceStatusApiResponse(),
      err instanceof Error ? err.message : "Binance status unavailable",
    );
  }
}
