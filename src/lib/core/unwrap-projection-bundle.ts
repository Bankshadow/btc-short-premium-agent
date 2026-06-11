import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { PnlProjection } from "./projections/pnl-projection";
import type { TradeProjection } from "./projections/trade-projection";
import type { PositionProjection } from "./projections/position-projection";
import type { RiskProjectionView } from "./projection-bundle-shared";
import { isProjectionBundleLike } from "./projection-api-response";

export interface ProjectionBundlePayload {
  mission?: MissionSnapshot;
  trades?: TradeProjection;
  positions?: PositionProjection;
  pnl?: PnlProjection;
  evidence?: EvidenceProgress;
  risk?: RiskProjectionView;
  health?: CoreHealthReport | null;
  meta?: { eventCount?: number; builtAt?: string; cacheKey?: string };
}

export interface UnwrapProjectionBundleResult {
  payload: ProjectionBundlePayload | null;
  valid: boolean;
  envelopeOk: boolean;
  usedFallback: boolean;
}

function stripBundleEnvelope(raw: Record<string, unknown>): ProjectionBundlePayload {
  const { ok: _ok, meta, error: _error, ...rest } = raw;
  return { ...rest, meta: meta as ProjectionBundlePayload["meta"] };
}

function isValidBundlePayload(payload: ProjectionBundlePayload | null): boolean {
  return payload != null && payload.mission != null && payload.trades != null;
}

function extractPayloadFromData(data: unknown): ProjectionBundlePayload | null {
  if (data == null || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  if (isProjectionBundleLike(record) && ("mission" in record || "trades" in record)) {
    return stripBundleEnvelope(record);
  }

  if ("data" in record && record.data != null && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (isProjectionBundleLike(nested)) {
      return stripBundleEnvelope(nested);
    }
  }

  return null;
}

/**
 * Robust unwrap for projection bundle API responses (Cases A/B/C).
 */
export function unwrapProjectionBundle(json: unknown): UnwrapProjectionBundleResult {
  if (json == null || typeof json !== "object") {
    return { payload: null, valid: false, envelopeOk: false, usedFallback: true };
  }

  const envelope = json as {
    ok?: boolean;
    data?: unknown;
    error?: unknown;
  };

  const envelopeOk = envelope.ok === true;
  let payload = extractPayloadFromData(envelope.data);

  if (!payload && isProjectionBundleLike(envelope)) {
    payload = stripBundleEnvelope(envelope as Record<string, unknown>);
  }

  if (isValidBundlePayload(payload)) {
    const valid = envelopeOk;
    return {
      payload,
      valid,
      envelopeOk,
      usedFallback: !valid,
    };
  }

  if (payload?.mission || payload?.trades) {
    return {
      payload,
      valid: false,
      envelopeOk,
      usedFallback: true,
    };
  }

  return { payload: null, valid: false, envelopeOk, usedFallback: true };
}

export function bundleHasRealData(payload: ProjectionBundlePayload): boolean {
  const closed = payload.trades?.closed?.length ?? 0;
  const total = payload.mission?.totalTrades ?? 0;
  return closed > 0 || total > 0 || payload.mission?.latestRunId != null;
}
