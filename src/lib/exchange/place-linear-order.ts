import type { ExchangeCredentials } from "./exchange-config";
import { bybitPrivatePost } from "./bybit-auth-client";
import type { MappedLinearOrder } from "./instrument-mapper";

interface CreateOrderResult {
  orderId: string;
  orderLinkId?: string;
}

export async function placeLinearMarketOrder(
  creds: ExchangeCredentials,
  order: MappedLinearOrder,
): Promise<{ orderId: string }> {
  const { result } = await bybitPrivatePost<CreateOrderResult>(
    creds,
    "/v5/order/create",
    order as unknown as Record<string, unknown>,
  );

  if (!result.orderId) {
    throw new Error("Bybit returned empty orderId");
  }

  return { orderId: result.orderId };
}
