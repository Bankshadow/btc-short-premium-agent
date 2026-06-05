import type { ExchangeCredentials } from "./exchange-config";
import { bybitPrivateGet } from "./bybit-auth-client";
import type { ExchangeWalletSnapshot } from "./types";

interface WalletBalanceResult {
  list: Array<{
    accountType: string;
    totalEquity?: string;
    totalWalletBalance?: string;
    coin?: Array<{
      coin: string;
      walletBalance?: string;
      availableToWithdraw?: string;
      equity?: string;
      usdValue?: string;
    }>;
  }>;
}

function num(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchWalletSnapshot(
  creds: ExchangeCredentials,
): Promise<ExchangeWalletSnapshot | null> {
  const { result } = await bybitPrivateGet<WalletBalanceResult>(
    creds,
    "/v5/account/wallet-balance",
    { accountType: "UNIFIED" },
  );

  const row = result.list?.[0];
  if (!row) return null;

  const coins =
    row.coin?.map((c) => ({
      coin: c.coin,
      walletBalance: num(c.walletBalance),
      availableBalance: num(c.availableToWithdraw),
      equityUsd: num(c.usdValue) || num(c.equity),
    })) ?? [];

  return {
    accountType: row.accountType,
    totalEquityUsd: num(row.totalEquity),
    totalWalletBalanceUsd: num(row.totalWalletBalance),
    coins: coins.filter((c) => c.walletBalance > 0 || c.equityUsd > 0),
  };
}
