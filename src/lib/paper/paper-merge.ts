import type { PaperOrder } from "./paper-order-types";
import { loadPaperOrders, persistPaperOrders } from "./paper-orders";

/** Merge remote orders into local store (remote wins on same client_id if newer). */
export function mergePaperOrdersFromRemote(remote: PaperOrder[]): PaperOrder[] {
  if (remote.length === 0) return loadPaperOrders();

  const local = loadPaperOrders();
  const byId = new Map(local.map((o) => [o.id, o]));

  for (const order of remote) {
    const existing = byId.get(order.id);
    if (!existing) {
      byId.set(order.id, order);
      continue;
    }
    const existingTs = new Date(existing.lastMarkAt ?? existing.openedAt).getTime();
    const remoteTs = new Date(order.lastMarkAt ?? order.openedAt).getTime();
    if (remoteTs >= existingTs) {
      byId.set(order.id, { ...order, supabaseId: order.supabaseId ?? existing.supabaseId });
    }
  }

  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
  return persistPaperOrders(merged);
}
