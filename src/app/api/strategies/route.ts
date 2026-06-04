import { STRATEGY_REGISTRY_SEEDS } from "@/lib/strategy-registry/strategy-registry-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** MVP 13 — registry schema & seeds (full registry built client-side). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mvp: 13,
    analysisOnly: true,
    statuses: [
      "DRAFT",
      "PAPER_TESTING",
      "ACTIVE",
      "WATCHLIST",
      "DISABLED",
      "DEPRECATED",
    ],
    productTypes: ["OPTIONS", "SPOT", "FUTURES", "PORTFOLIO"],
    riskLevels: ["LOW", "MEDIUM", "HIGH", "AGGRESSIVE"],
    seeds: STRATEGY_REGISTRY_SEEDS.map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version,
      productType: s.productType,
      ownerAgent: s.ownerAgent,
      defaultStatus: s.defaultStatus,
    })),
    gates: {
      disabledCannotProposeTrade: true,
      paperTestingBlocksTradeTickets: true,
      noLiveExecution: true,
    },
    clientReportHint:
      "Open /strategies in the browser to manage registry from decision log + paper book.",
  });
}
