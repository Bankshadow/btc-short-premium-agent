import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import { fetchWalletSnapshot } from "@/lib/exchange/wallet";
import { resolveExchangeCredentials } from "@/lib/exchange/exchange-config";
import { mergeDryRunHistory } from "@/lib/options-dry-run/dry-run-store";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { OptionsDryRunResult } from "@/lib/options-dry-run/types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";
import type { OptionsRiskInput } from "./types";

export type OptionsRiskClientPayload = {
  paperOrders?: PaperOrder[];
  dryRunHistory?: OptionsDryRunResult[];
  preview?: OptionsOrderPreview | null;
  spotPrice?: number | null;
};

export async function buildOptionsRiskServerInput(
  client: OptionsRiskClientPayload = {},
): Promise<OptionsRiskInput> {
  let exchangePositions: OptionsRiskInput["exchangePositions"];
  let walletBalanceUsd: number | null = null;
  let spotPrice = client.spotPrice ?? null;

  try {
    const ex = await buildExchangeStatus();
    exchangePositions = ex.optionPositions;
    if (ex.wallet) {
      walletBalanceUsd = ex.wallet.totalEquityUsd;
      const usdt = ex.wallet.coins.find((c) => c.coin === "USDT");
      if (usdt?.availableBalance) walletBalanceUsd = usdt.availableBalance;
    }
  } catch {
    exchangePositions = [];
  }

  if (walletBalanceUsd == null) {
    const creds = resolveExchangeCredentials();
    if (creds) {
      try {
        const wallet = await fetchWalletSnapshot(creds);
        walletBalanceUsd = wallet?.totalEquityUsd ?? null;
      } catch {
        /* optional */
      }
    }
  }

  const dryRunResults = await mergeDryRunHistory(client.dryRunHistory);

  return {
    paperOrders: client.paperOrders ?? [],
    exchangePositions,
    dryRunResults: dryRunResults.slice(0, 20),
    preview: client.preview ?? null,
    spotPrice,
    walletBalanceUsd,
  };
}
