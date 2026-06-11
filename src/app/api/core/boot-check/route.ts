import { NextResponse } from "next/server";
import { readCoreEvents } from "@/lib/core/event-store";
import { buildProjectionById } from "@/lib/core/projection-engine";
import { buildEnrichedTradeProjection } from "@/lib/core/build-enriched-trade-projection";
import { evaluateCoreHealth } from "@/lib/core/core-health";
import { getBinanceTestnetStatusBounded } from "@/lib/execution/binance-testnet-status";
import { API_RESPONSE_BOUND_MS } from "@/lib/core/zero-state";

const FORBIDDEN = ["secret", "apisecret", "api_secret", "password"];

function hasSecretLeak(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return FORBIDDEN.some((k) => lower.includes(k) && value.length > 12);
  }
  if (Array.isArray(value)) return value.some(hasSecretLeak);
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => FORBIDDEN.some((f) => k.toLowerCase().includes(f)) || hasSecretLeak(v),
    );
  }
  return false;
}

async function probeApi(label: string, run: () => Promise<unknown>): Promise<"OK" | "FAIL"> {
  try {
    await run();
    return "OK";
  } catch {
    return "FAIL";
  }
}

export async function GET() {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  const apis = {
    coreHealth: await probeApi("coreHealth", () => evaluateCoreHealth()),
    missionProjection: await probeApi("missionProjection", async () => {
      buildProjectionById("mission", await readCoreEvents());
    }),
    tradeProjection: await probeApi("tradeProjection", async () => {
      await buildEnrichedTradeProjection(await readCoreEvents());
    }),
    positionProjection: await probeApi("positionProjection", async () => {
      buildProjectionById("positions", await readCoreEvents());
    }),
    pnlProjection: await probeApi("pnlProjection", async () => {
      buildProjectionById("pnl", await readCoreEvents());
    }),
    evidenceProjection: await probeApi("evidenceProjection", async () => {
      buildProjectionById("evidence", await readCoreEvents());
    }),
    riskProjection: await probeApi("riskProjection", async () => {
      buildProjectionById("risk", await readCoreEvents());
    }),
    binanceStatus: await probeApi("binanceStatus", async () => {
      await getBinanceTestnetStatusBounded(API_RESPONSE_BOUND_MS);
    }),
  };

  for (const [name, status] of Object.entries(apis)) {
    if (status === "FAIL") warnings.push(`${name}: probe failed`);
  }

  if (apis.coreHealth === "FAIL") {
    criticalIssues.push("Core health evaluation failed");
  }

  const zeroStateReady = Object.values(apis).every((s) => s === "OK");
  const corePagesShouldRender = zeroStateReady;

  const payload = {
    ok: criticalIssues.length === 0,
    app: "btc-short-premium-agent",
    corePagesShouldRender,
    zeroStateReady,
    apis,
    criticalIssues,
    warnings,
    liveLocked: true,
    checkedAt: new Date().toISOString(),
  };

  if (hasSecretLeak(payload)) {
    return NextResponse.json({ ok: false, error: "Boot check refused — secret leak risk" }, { status: 500 });
  }

  return NextResponse.json(payload);
}
