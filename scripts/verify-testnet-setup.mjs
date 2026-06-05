#!/usr/bin/env node
/**
 * Verifies Bybit testnet credentials and desk env for live perp (MVP 34).
 * Usage: node scripts/verify-testnet-setup.mjs
 * Loads: .env.local then .env (first wins per file order; later files don't override)
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const RECV_WINDOW = "5000";
const TESTNET_URL = "https://api-testnet.bybit.com";

function truthy(name) {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function mask(value) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function signGet(timestamp, apiKey, queryString, apiSecret) {
  const payload = timestamp + apiKey + RECV_WINDOW + queryString;
  return crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
}

async function bybitWalletBalance(apiKey, apiSecret) {
  const queryString = "accountType=UNIFIED";
  const timestamp = String(Date.now());
  const sign = signGet(timestamp, apiKey, queryString, apiSecret);
  const url = `${TESTNET_URL}/v5/account/wallet-balance?${queryString}`;
  const res = await fetch(url, {
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-SIGN": sign,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    },
  });
  const json = await res.json();
  return { httpStatus: res.status, ...json };
}

const checks = [];
function ok(label, detail) {
  checks.push({ ok: true, label, detail });
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  checks.push({ ok: false, label, detail });
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, detail) {
  checks.push({ ok: true, label, detail, warn: true });
  console.log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n🔍 BTC Desk — Testnet setup verification\n");

// Env checks
const apiKey = process.env.BYBIT_API_KEY?.trim();
const apiSecret = process.env.BYBIT_API_SECRET?.trim();
const testnet = truthy("BYBIT_TESTNET");
const live = truthy("LIVE_EXECUTION_ENABLED");
const cronSecret = process.env.CRON_SECRET?.trim();

if (apiKey && apiSecret) {
  ok("BYBIT_API_KEY / BYBIT_API_SECRET", `key ${mask(apiKey)}`);
} else {
  fail("BYBIT_API_KEY / BYBIT_API_SECRET", "run scripts/setup-testnet.ps1 or edit .env.local");
}

if (testnet) {
  ok("BYBIT_TESTNET", "true → api-testnet.bybit.com");
} else {
  fail("BYBIT_TESTNET", "must be true for testnet keys");
}

if (live) {
  ok("LIVE_EXECUTION_ENABLED", "live execute allowed on /assets");
} else {
  warn("LIVE_EXECUTION_ENABLED", "false — preview only, execute blocked");
}

if (cronSecret) {
  ok("CRON_SECRET", "confirm token signing ready");
} else {
  warn("CRON_SECRET", "missing — execute confirm token may fail");
}

const maxNotional = process.env.LIVE_MAX_NOTIONAL_USD?.trim() ?? "500";
const allowed = process.env.LIVE_ALLOWED_SYMBOLS?.trim() ?? "(all desk perps)";
console.log(`  ℹ️  LIVE_MAX_NOTIONAL_USD = ${maxNotional}`);
console.log(`  ℹ️  LIVE_ALLOWED_SYMBOLS = ${allowed}`);

// API test
if (apiKey && apiSecret && testnet) {
  console.log("\n📡 Calling Bybit testnet wallet API…\n");
  try {
    const result = await bybitWalletBalance(apiKey, apiSecret);
    if (result.retCode === 0) {
      const row = result.result?.list?.[0];
      const equity = row?.totalEquity ?? row?.totalWalletBalance ?? "?";
      ok("Bybit testnet auth", `UNIFIED equity ≈ ${equity} USD`);
      const usdt = row?.coin?.find((c) => c.coin === "USDT");
      if (usdt) {
        console.log(`     USDT wallet: ${usdt.walletBalance ?? usdt.equity ?? "?"}`);
      } else {
        warn("Testnet balance", "no USDT — claim demo funds at testnet.bybit.com");
      }
    } else if (result.retCode === 10003) {
      fail(
        "Bybit testnet auth",
        "Invalid API key — key must be from testnet.bybit.com (not mainnet)",
      );
    } else {
      fail("Bybit testnet auth", `retCode ${result.retCode}: ${result.retMsg}`);
    }
  } catch (error) {
    fail("Bybit testnet auth", error instanceof Error ? error.message : String(error));
  }
}

const failed = checks.filter((c) => !c.ok).length;
console.log("\n" + "─".repeat(50));
if (failed === 0) {
  console.log("✅ Ready for local dev. Next:");
  console.log("   1. npm run dev");
  console.log("   2. Open http://localhost:3000/governance → Exchange Status");
  console.log("   3. Open http://localhost:3000/assets → Preview → Execute (if LIVE on)");
  console.log("\n   Vercel: run scripts/push-vercel-env.ps1 after filling .env.local\n");
} else {
  console.log(`❌ ${failed} check(s) failed. Run:  npm run setup:testnet\n`);
  process.exit(1);
}
