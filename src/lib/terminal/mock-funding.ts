/** Simulated funding until a real perp feed is wired. Paper / display only. */
export function mockFundingRate(symbol: "BTC" | "ETH"): { rate: number; simulated: true } {
  const base = symbol === "BTC" ? 0.00012 : 0.00008;
  const jitter = (Date.now() % 1000) / 1_000_000;
  return { rate: Number((base + jitter).toFixed(6)), simulated: true };
}
