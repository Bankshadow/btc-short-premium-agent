import type { PolymarketConfig } from "./config-types";
import type { CryptoPriceSnapshot, PolymarketHealthReport } from "./types";

export function buildPolymarketHealth(input: {
  config: PolymarketConfig;
  btc: CryptoPriceSnapshot;
  eth: CryptoPriceSnapshot;
  lastSuccessfulUpdate: string | null;
  errorCount: number;
  polymarketCapturedAt: string | null;
}): PolymarketHealthReport {
  const messages: string[] = [];
  const now = Date.now();

  const btcAge = (now - Date.parse(input.btc.timestamp)) / 1000;
  const ethAge = (now - Date.parse(input.eth.timestamp)) / 1000;
  const polyAge = input.polymarketCapturedAt
    ? (now - Date.parse(input.polymarketCapturedAt)) / 1000
    : Infinity;

  const cryptoDataFresh =
    btcAge <= input.config.staleDataThresholdSeconds &&
    ethAge <= input.config.staleDataThresholdSeconds &&
    input.btc.quality === "FRESH" &&
    input.eth.quality === "FRESH";

  const polymarketDataFresh =
    polyAge <= input.config.staleDataThresholdSeconds * 2;

  if (!cryptoDataFresh) messages.push("Crypto price data stale or degraded.");
  if (!polymarketDataFresh) messages.push("Polymarket snapshot stale.");
  if (input.config.killSwitchActive) messages.push("Kill switch active.");
  if (input.errorCount > 0) messages.push(`${input.errorCount} error(s) in recent cycles.`);

  let status: PolymarketHealthReport["status"] = "OK";
  if (input.config.killSwitchActive || !cryptoDataFresh) status = "BLOCKED";
  else if (!polymarketDataFresh || input.errorCount > 0) status = "WARNING";

  return {
    status,
    polymarketDataFresh,
    cryptoDataFresh,
    fairPriceEngineOk: true,
    paperSimulatorOk: input.config.paperTradingEnabled,
    riskManagerOk: !input.config.killSwitchActive,
    killSwitchActive: input.config.killSwitchActive,
    lastSuccessfulUpdate: input.lastSuccessfulUpdate,
    errorCount: input.errorCount,
    messages,
    realTradingEnabled: false,
    paperTradingEnabled: input.config.paperTradingEnabled,
  };
}
