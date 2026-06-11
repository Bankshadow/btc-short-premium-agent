import type { CoreHealthReport } from "./core-health";
import type { EvidenceProgress } from "@/lib/evidence/evidence-types";
import type { MissionSnapshot } from "@/lib/mission/mission-types";
import type { PnlProjection } from "./projections/pnl-projection";
import type { TradeProjection } from "./projections/trade-projection";
import type { PositionProjection } from "./projections/position-projection";
import type { RiskProjectionView } from "./projection-bundle-shared";
import { isProjectionBundleLike } from "./projection-api-response";
import type { DefaultBinanceStatus } from "./projection-defaults";

export interface ProjectionBundlePayload {
  mission?: MissionSnapshot;
  trades?: TradeProjection;
  positions?: PositionProjection;
  pnl?: PnlProjection;
  evidence?: EvidenceProgress;
  risk?: RiskProjectionView;
  health?: CoreHealthReport | null;
  meta?: { eventCount?: number; builtAt?: string; cacheKey?: string };
  binanceStatus?: DefaultBinanceStatus;
}

export interface NormalizedProjectionBundle extends ProjectionBundlePayload {
  mission: MissionSnapshot;
  trades: TradeProjection;
  positions: PositionProjection;
  pnl: PnlProjection;
  evidence: EvidenceProgress;
  risk: RiskProjectionView;
  health: CoreHealthReport;
  binanceStatus: DefaultBinanceStatus;
  meta: { eventCount?: number; builtAt?: string; cacheKey?: string };
  isFallback: boolean;
  warnings: string[];
}

export interface ProjectionBundleShapeDebug {
  ok: boolean;
  topLevelKeys: string[];
  dataKeys: string[];
  nestedDataKeys: string[];
  hasMission: boolean;
  hasTrades: boolean;
  missionKeys: string[];
  tradesKeys: string[];
  evidenceKeys: string[];
  healthKeys: string[];
  sampleValues: {
    missionTotalTrades: number | null;
    tradesClosedLength: number | null;
    tradesOpenLength: number | null;
    effectiveOpenCount: number | null;
    evidenceValid: number | null;
    evidenceRequired: number | null;
    healthStatus: string | null;
    binanceStatus: string | null;
  };
  warnings: string[];
  checkedAt: string;
}

function objectKeys(value: unknown): string[] {
  if (value == null || typeof value !== "object") return [];
  return Object.keys(value as Record<string, unknown>).sort();
}

function stripInnerEnvelope(raw: Record<string, unknown>): Record<string, unknown> {
  const { ok: _ok, error: _error, ...rest } = raw;
  return rest;
}

function extractBundleLayers(raw: unknown): {
  top: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  nested: Record<string, unknown> | null;
  payload: ProjectionBundlePayload | null;
} {
  if (raw == null || typeof raw !== "object") {
    return { top: null, data: null, nested: null, payload: null };
  }

  const top = raw as Record<string, unknown>;
  let data: Record<string, unknown> | null = null;
  let nested: Record<string, unknown> | null = null;
  let payload: ProjectionBundlePayload | null = null;

  if ("data" in top && top.data != null && typeof top.data === "object") {
    data = top.data as Record<string, unknown>;
    if ("data" in data && data.data != null && typeof data.data === "object") {
      nested = data.data as Record<string, unknown>;
    }
  } else if (isProjectionBundleLike(top)) {
    data = top;
  }

  const candidates = [nested, data, top].filter(Boolean) as Record<string, unknown>[];
  for (const candidate of candidates) {
    const stripped = isProjectionBundleLike(candidate) ? stripInnerEnvelope(candidate) : candidate;
    if (stripped.mission != null && stripped.trades != null) {
      payload = stripped as ProjectionBundlePayload;
      break;
    }
    if (isProjectionBundleLike(stripped) && (stripped.mission != null || stripped.trades != null)) {
      payload = stripped as ProjectionBundlePayload;
    }
  }

  return { top, data, nested, payload };
}

export function inspectProjectionBundleShape(raw: unknown): ProjectionBundleShapeDebug {
  const checkedAt = new Date().toISOString();
  const warnings: string[] = [];
  const { top, data, nested, payload } = extractBundleLayers(raw);

  if (!top) {
    return {
      ok: false,
      topLevelKeys: [],
      dataKeys: [],
      nestedDataKeys: [],
      hasMission: false,
      hasTrades: false,
      missionKeys: [],
      tradesKeys: [],
      evidenceKeys: [],
      healthKeys: [],
      sampleValues: {
        missionTotalTrades: null,
        tradesClosedLength: null,
        tradesOpenLength: null,
        effectiveOpenCount: null,
        evidenceValid: null,
        evidenceRequired: null,
        healthStatus: null,
        binanceStatus: null,
      },
      warnings: ["Response is not a JSON object"],
      checkedAt,
    };
  }

  const mission = payload?.mission as Record<string, unknown> | undefined;
  const trades = payload?.trades as Record<string, unknown> | undefined;
  const evidence = payload?.evidence as Record<string, unknown> | undefined;
  const health = payload?.health as Record<string, unknown> | undefined;
  const binance = payload?.binanceStatus as Record<string, unknown> | undefined;

  if (!payload?.mission) warnings.push("mission missing after unwrap");
  if (!payload?.trades) warnings.push("trades missing after unwrap");

  const closed = Array.isArray(trades?.closed) ? trades!.closed : [];
  const open = Array.isArray(trades?.open) ? trades!.open : [];

  return {
    ok: Boolean(payload?.mission && payload?.trades),
    topLevelKeys: objectKeys(top),
    dataKeys: objectKeys(data),
    nestedDataKeys: objectKeys(nested),
    hasMission: payload?.mission != null,
    hasTrades: payload?.trades != null,
    missionKeys: objectKeys(mission),
    tradesKeys: objectKeys(trades),
    evidenceKeys: objectKeys(evidence),
    healthKeys: objectKeys(health),
    sampleValues: {
      missionTotalTrades:
        typeof mission?.totalTrades === "number" ? (mission.totalTrades as number) : null,
      tradesClosedLength: closed.length,
      tradesOpenLength: open.length,
      effectiveOpenCount:
        typeof trades?.effectiveOpenCount === "number"
          ? (trades.effectiveOpenCount as number)
          : null,
      evidenceValid: typeof evidence?.valid === "number" ? (evidence.valid as number) : null,
      evidenceRequired:
        typeof evidence?.required === "number" ? (evidence.required as number) : null,
      healthStatus: typeof health?.status === "string" ? (health.status as string) : null,
      binanceStatus: typeof binance?.status === "string" ? (binance.status as string) : null,
    },
    warnings,
    checkedAt,
  };
}

export function extractProjectionBundlePayload(raw: unknown): ProjectionBundlePayload | null {
  return extractBundleLayers(raw).payload;
}

export function bundlePayloadReady(payload: ProjectionBundlePayload | null): boolean {
  return payload?.mission != null && payload?.trades != null;
}
