import type { JournalEvent } from "@/lib/journal/journal-types";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";

export const MVP5_NOT_READY_MESSAGE =
  "Not ready for MVP 5: no open testnet trade to monitor yet.";

export interface Mvp5Readiness {
  ready: boolean;
  message: string;
  reasons: string[];
}

export function computeReadyForMvp5(input: {
  binanceStatus: BinanceTestnetStatus;
  events: JournalEvent[];
  openTradeCount: number;
}): Mvp5Readiness {
  const reasons: string[] = [];

  if (input.binanceStatus.status !== "CONNECTED") {
    reasons.push(`Binance status is ${input.binanceStatus.status}, not CONNECTED.`);
  }

  const hasOrderExecuted = input.events.some((e) => e.type === "ORDER_EXECUTED");
  if (!hasOrderExecuted) {
    reasons.push("No ORDER_EXECUTED event in journal.");
  }

  const hasPositionOpened = input.events.some((e) => e.type === "POSITION_OPENED");
  if (!hasPositionOpened) {
    reasons.push("No POSITION_OPENED event in journal.");
  }

  if (input.openTradeCount < 1) {
    reasons.push("No OPEN trade exists.");
  }

  const ready = reasons.length === 0;

  return {
    ready,
    message: ready ? "Ready for MVP 5 position monitor." : MVP5_NOT_READY_MESSAGE,
    reasons,
  };
}
