import { NextResponse } from "next/server";
import { loadLedgerAnalyticsInput } from "@/lib/ledger/analytics";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { getStoredPreview } from "@/lib/exchange/binance/binance-order-preview";
import { buildTradeLifecycleTimeline } from "@/lib/trade-lifecycle";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ tradeId: string }> },
) {
  try {
    const { tradeId } = await context.params;
    if (!tradeId) {
      return NextResponse.json(
        { ok: false, error: "tradeId required" },
        { status: 400 },
      );
    }

    const { ledger } = loadLedgerAnalyticsInput();
    const [binanceJournal, testnetSnapshot, monitorEvents] = await Promise.all([
      loadServerBinanceTestnetJournal().catch(() => []),
      buildTestnetMonitorSnapshot().catch(() => null),
      loadMonitorJournalEvents().catch(() => []),
    ]);

    const previewIdFromQuery = new URL(request.url).searchParams.get("previewId");
    const preview = previewIdFromQuery
      ? await getStoredPreview(previewIdFromQuery).catch(() => null)
      : null;

    const timeline = buildTradeLifecycleTimeline({
      lookupId: tradeId,
      ledger,
      testnetSnapshot,
      binanceJournal,
      monitorEvents,
      preview,
    });

    if (!timeline) {
      return NextResponse.json(
        { ok: false, error: "Trade timeline not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, timeline });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Timeline fetch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
