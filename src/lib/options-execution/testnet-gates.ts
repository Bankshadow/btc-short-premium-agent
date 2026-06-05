import { resolveExchangeCredentials } from "@/lib/exchange/exchange-config";
import { blockLiveOptionsAttempt, loadOptionsExecutionConfig } from "./config";

export const OPTIONS_TESTNET_BANNER =
  "BTC options testnet only — production options live is not implemented.";

export const PRODUCTION_OPTIONS_HARD_ERROR =
  "BTC options production execution is not implemented. Hard block — use testnet only.";

function isBybitTestnetFlag(): boolean {
  const raw = process.env.BYBIT_TESTNET?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Hard block for any production / live BTC options order route. */
export function blockProductionOptionsOrder(): string | null {
  const liveBlock = blockLiveOptionsAttempt();
  if (liveBlock) return liveBlock;

  const creds = resolveExchangeCredentials();
  if (creds?.network === "mainnet") {
    return PRODUCTION_OPTIONS_HARD_ERROR;
  }

  if (creds && !creds.baseUrl.includes("testnet")) {
    return PRODUCTION_OPTIONS_HARD_ERROR;
  }

  return null;
}

export interface OptionsTestnetGateResult {
  allowed: boolean;
  blockers: string[];
}

/** Gate for testnet-only BTC options execution (MVP 39). */
export function assertOptionsTestnetExecutionAllowed(): OptionsTestnetGateResult {
  const blockers: string[] = [];

  const productionBlock = blockProductionOptionsOrder();
  if (productionBlock) blockers.push(productionBlock);

  const config = loadOptionsExecutionConfig();
  if (!config.testnetEnabled) {
    blockers.push(
      "OPTIONS_TESTNET_ENABLED is not true — testnet options execution blocked.",
    );
  }

  if (!isBybitTestnetFlag()) {
    blockers.push("BYBIT_TESTNET must be true for options testnet execution.");
  }

  const creds = resolveExchangeCredentials();
  if (!creds) {
    blockers.push("Exchange credentials not configured (BYBIT_API_KEY/SECRET).");
  } else if (creds.network !== "testnet") {
    blockers.push(
      "Exchange network is not testnet — options execution blocked (no production endpoint).",
    );
  } else if (!creds.baseUrl.includes("testnet")) {
    blockers.push(PRODUCTION_OPTIONS_HARD_ERROR);
  }

  return { allowed: blockers.length === 0, blockers };
}
