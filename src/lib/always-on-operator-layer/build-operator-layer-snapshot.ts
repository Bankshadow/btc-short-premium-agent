import { emptyAlwaysOnOperatorLayer } from "./empty-snapshot";
import { loadOperatorLayerSnapshot } from "./run-operator-layer-tick";
import type { AlwaysOnOperatorLayerSnapshot } from "./types";

const OPERATOR_LAYER_STALE_MS = 20 * 60_000;

function operatorLayerLastTickAt(snapshot: AlwaysOnOperatorLayerSnapshot | null): string | null {
  return snapshot?.heartbeat.lastTickAt ?? snapshot?.lastUpdatedAt ?? null;
}

/** Server-only — refreshes operator tick when cache is stale (>20 min). */
export async function buildAlwaysOnOperatorLayerSnapshot(): Promise<AlwaysOnOperatorLayerSnapshot> {
  const cached = await loadOperatorLayerSnapshot();
  const lastTickAt = operatorLayerLastTickAt(cached);
  const stale =
    !cached ||
    !lastTickAt ||
    Date.now() - Date.parse(lastTickAt) > OPERATOR_LAYER_STALE_MS;

  if (stale) {
    try {
      const { runOperatorLayerTick } = await import("./run-operator-layer-tick");
      return await runOperatorLayerTick({ trigger: "manual" });
    } catch {
      /* fall back to cached snapshot */
    }
  }

  return cached ?? emptyAlwaysOnOperatorLayer();
}
