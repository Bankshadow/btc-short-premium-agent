import { emptyAlwaysOnOperatorLayer } from "./empty-snapshot";
import { loadOperatorLayerSnapshot } from "./run-operator-layer-tick";
import type { AlwaysOnOperatorLayerSnapshot } from "./types";

/** Server-only — loads last persisted operator tick snapshot. */
export async function buildAlwaysOnOperatorLayerSnapshot(): Promise<AlwaysOnOperatorLayerSnapshot> {
  const cached = await loadOperatorLayerSnapshot();
  return cached ?? emptyAlwaysOnOperatorLayer();
}
