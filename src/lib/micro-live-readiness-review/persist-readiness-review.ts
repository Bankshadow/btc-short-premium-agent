import { recordMonitorEvent } from "@/lib/testnet-monitor/monitor-journal-server";
import type { MicroLiveReadinessReviewSnapshot } from "./types";

export async function persistReadinessReviewSideEffects(input: {
  review: MicroLiveReadinessReviewSnapshot;
}): Promise<void> {
  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "READINESS_REVIEWED",
    symbol: null,
    decisionLogId: null,
    orderId: null,
    positionId: null,
    payload: {
      readinessStatus: input.review.readinessStatus,
      readinessScore: input.review.readinessScore,
      blockerCount: input.review.blockers.length,
      cannotEnableLive: true,
      cannotPlaceLiveOrders: true,
    },
  }).catch(() => undefined);
}
