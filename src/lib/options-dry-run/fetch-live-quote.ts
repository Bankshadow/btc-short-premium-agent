import { fetchOptionCandidates } from "@/lib/bybit/market";
import type { OptionCandidate } from "@/lib/types/market";
import type { OrderTicket } from "@/lib/trade-control/trade-control-types";

export async function fetchLiveOptionQuote(input: {
  ticket: OrderTicket;
  candidate?: OptionCandidate | null;
}): Promise<{
  candidate: OptionCandidate | null;
  quoteFetched: boolean;
  quoteError: string | null;
}> {
  if (input.candidate) {
    return { candidate: input.candidate, quoteFetched: true, quoteError: null };
  }

  const symbol = input.ticket.symbol;
  try {
    const chain = await fetchOptionCandidates("BTC");
    const match =
      chain.find((c) => c.symbol === symbol) ??
      chain.find(
        (c) =>
          c.strike === input.ticket.strike &&
          c.optionType ===
            (input.ticket.instrument === "sell_call" ? "call" : "put"),
      ) ??
      null;
    return {
      candidate: match,
      quoteFetched: true,
      quoteError: match ? null : `No live quote for ${symbol}`,
    };
  } catch (error) {
    return {
      candidate: null,
      quoteFetched: false,
      quoteError:
        error instanceof Error ? error.message : "Live quote fetch failed",
    };
  }
}
