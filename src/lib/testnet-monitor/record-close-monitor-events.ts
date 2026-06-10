import { recordMonitorEvent } from "./monitor-journal-server";

/** Journal + evidence pipeline events after a successful reduce-only close. */
export async function recordTestnetCloseMonitorEvents(input: {
  symbol: string;
  exchangeOrderId: string | null;
  decisionLogId: string | null;
  journalTradeId?: string | null;
  realizedPnl?: number | null;
  positionId?: string | null;
}): Promise<void> {
  await recordMonitorEvent({
    exchange: "BINANCE",
    environment: "TESTNET",
    eventType: "POSITION_CLOSED",
    symbol: input.symbol,
    payload: {
      exchangeOrderId: input.exchangeOrderId,
      tradeId: input.journalTradeId ?? null,
      journalTradeId: input.journalTradeId ?? null,
    },
    decisionLogId: input.decisionLogId,
    orderId: input.exchangeOrderId,
    positionId: input.positionId ?? null,
  });

  if (input.realizedPnl != null && Number.isFinite(input.realizedPnl)) {
    await recordMonitorEvent({
      exchange: "BINANCE",
      environment: "TESTNET",
      eventType: "PNL_REALIZED",
      symbol: input.symbol,
      payload: {
        realizedPnl: input.realizedPnl,
        tradeId: input.journalTradeId ?? null,
        journalTradeId: input.journalTradeId ?? null,
      },
      decisionLogId: input.decisionLogId,
      orderId: input.exchangeOrderId,
      positionId: input.positionId ?? null,
    });
  }
}
