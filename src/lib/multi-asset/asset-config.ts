export type PerpAssetId = "BTC" | "SOL" | "ETH" | "WLD" | "LINK" | "DOGE";

export interface PerpAssetConfig {
  id: PerpAssetId;
  symbol: string;
  label: string;
  /** True when the asset also has a liquid Bybit options market. */
  hasOptions: boolean;
}

/**
 * Assets the multi-asset perp directional desk scans.
 * All entries are USDT-margined linear perpetuals on Bybit.
 * WLD / LINK / DOGE have no options market, so they are perp-directional only.
 */
export const SUPPORTED_PERP_ASSETS: PerpAssetConfig[] = [
  { id: "BTC", symbol: "BTCUSDT", label: "Bitcoin", hasOptions: true },
  { id: "SOL", symbol: "SOLUSDT", label: "Solana", hasOptions: true },
  { id: "ETH", symbol: "ETHUSDT", label: "Ethereum", hasOptions: true },
  { id: "WLD", symbol: "WLDUSDT", label: "Worldcoin", hasOptions: false },
  { id: "LINK", symbol: "LINKUSDT", label: "Chainlink", hasOptions: false },
  { id: "DOGE", symbol: "DOGEUSDT", label: "Dogecoin", hasOptions: false },
];

export function getAssetConfig(symbol: string): PerpAssetConfig | undefined {
  return SUPPORTED_PERP_ASSETS.find((asset) => asset.symbol === symbol);
}
