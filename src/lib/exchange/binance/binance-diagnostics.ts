import {
  isBinanceTestnetBaseUrl,
  loadBinanceConfig,
  resolveBinanceUpstreamBaseUrl,
} from "./binance-config";
import type {
  BinanceConnectionBlocker,
  BinanceEnvCheckItem,
} from "./binance-types";

const CLOCK_SKEW_LIMIT_MS = 5_000;

export function buildBinanceEnvChecklist(): BinanceEnvCheckItem[] {
  const config = loadBinanceConfig();
  const apiKey = process.env.BINANCE_API_KEY?.trim();
  const apiSecret = process.env.BINANCE_API_SECRET?.trim();
  const upstream = resolveBinanceUpstreamBaseUrl();

  return [
    {
      key: "BINANCE_TESTNET_ENABLED",
      label: "Testnet enabled",
      value: config.testnetEnabled ? "true" : "false",
      ok: config.testnetEnabled,
      secret: false,
    },
    {
      key: "BINANCE_LIVE_ENABLED",
      label: "Live disabled (must be false)",
      value: config.liveEnabled ? "true" : "false",
      ok: !config.liveEnabled,
      secret: false,
    },
    {
      key: "BINANCE_API_KEY",
      label: "API key present",
      value: apiKey ? "set" : "missing",
      ok: Boolean(apiKey),
      secret: true,
    },
    {
      key: "BINANCE_API_SECRET",
      label: "API secret present",
      value: apiSecret ? "set" : "missing",
      ok: Boolean(apiSecret),
      secret: true,
    },
    {
      key: "BINANCE_FUTURES_TESTNET_BASE_URL",
      label: "Testnet base URL",
      value: upstream,
      ok: isBinanceTestnetBaseUrl(upstream),
      secret: false,
    },
    {
      key: "BINANCE_ALLOWED_SYMBOLS",
      label: "Allowed symbols",
      value: config.allowedSymbols.join(", ") || "—",
      ok: config.allowedSymbols.length > 0,
      secret: false,
    },
    {
      key: "BINANCE_TESTNET_MAX_NOTIONAL_USD",
      label: "Max notional (USD)",
      value: String(config.maxNotionalUsd),
      ok: config.maxNotionalUsd > 0,
      secret: false,
    },
    {
      key: "BINANCE_REQUIRE_DOUBLE_CONFIRM",
      label: "Require double confirm",
      value: config.requireDoubleConfirm ? "true" : "false",
      ok: true,
      secret: false,
    },
  ];
}

/** Categorize why testnet is not connected, in operator-friendly terms. */
export function buildBinanceBlockers(input: {
  apiError: string | null;
  clockSkewMs: number | null;
}): BinanceConnectionBlocker[] {
  const config = loadBinanceConfig();
  const apiKey = process.env.BINANCE_API_KEY?.trim();
  const apiSecret = process.env.BINANCE_API_SECRET?.trim();
  const upstream = resolveBinanceUpstreamBaseUrl();
  const blockers: BinanceConnectionBlocker[] = [];

  if (!apiKey) {
    blockers.push({
      category: "MISSING_KEY",
      detail: "BINANCE_API_KEY is not set on the server.",
    });
  }
  if (!apiSecret) {
    blockers.push({
      category: "MISSING_SECRET",
      detail: "BINANCE_API_SECRET is not set on the server.",
    });
  }
  if (!config.testnetEnabled) {
    blockers.push({
      category: "TESTNET_DISABLED",
      detail: "BINANCE_TESTNET_ENABLED must be true.",
    });
  }
  if (config.liveEnabled) {
    blockers.push({
      category: "LIVE_ENABLED",
      detail: "BINANCE_LIVE_ENABLED must remain false (testnet-only).",
    });
  }
  if (!isBinanceTestnetBaseUrl(upstream)) {
    blockers.push({
      category: "WRONG_BASE_URL",
      detail: `Base URL "${upstream}" is not a recognized testnet host.`,
    });
  }
  if (input.clockSkewMs != null && input.clockSkewMs > CLOCK_SKEW_LIMIT_MS) {
    blockers.push({
      category: "CLOCK_SKEW",
      detail: `Clock skew ${input.clockSkewMs}ms exceeds ${CLOCK_SKEW_LIMIT_MS}ms — check system time.`,
    });
  }

  if (input.apiError) {
    const lower = input.apiError.toLowerCase();
    if (
      lower.includes("-2015") ||
      lower.includes("-2014") ||
      lower.includes("permission") ||
      lower.includes("invalid api-key") ||
      lower.includes("unauthorized")
    ) {
      blockers.push({
        category: "PERMISSION",
        detail: `Binance rejected credentials/permissions: ${input.apiError}`,
      });
    } else if (
      // Only treat as generic API error if not already explained above.
      !blockers.some((b) =>
        ["MISSING_KEY", "MISSING_SECRET", "WRONG_BASE_URL"].includes(b.category),
      )
    ) {
      blockers.push({
        category: "API_ERROR",
        detail: input.apiError,
      });
    }
  }

  return blockers;
}

export function buildBinanceEnvChecklistText(
  checklist: BinanceEnvCheckItem[],
  blockers: BinanceConnectionBlocker[],
): string {
  const lines: string[] = [
    "# Binance USD-M Futures Testnet — env checklist",
    "",
    ...checklist.map(
      (item) => `${item.ok ? "[x]" : "[ ]"} ${item.key} = ${item.value}`,
    ),
  ];
  if (blockers.length > 0) {
    lines.push("", "# Blockers");
    for (const b of blockers) {
      lines.push(`- (${b.category}) ${b.detail}`);
    }
  } else {
    lines.push("", "# Blockers", "- none");
  }
  return lines.join("\n");
}
