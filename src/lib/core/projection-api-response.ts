import { NextResponse } from "next/server";

export interface ProjectionApiErrorBody {
  code: string;
  message: string;
  severity: "WARNING" | "BLOCK";
}

export interface ProjectionApiEnvelope<T> {
  ok: boolean;
  data: T;
  error: ProjectionApiErrorBody | null;
}

export const PROJECTION_FALLBACK_ERROR = {
  code: "PROJECTION_FALLBACK",
  severity: "WARNING" as const,
};

export function projectionApiOk<T>(data: T, status = 200) {
  return NextResponse.json(
    { ok: true, data, error: null } satisfies ProjectionApiEnvelope<T>,
    { status },
  );
}

export function projectionApiFail<T>(
  data: T,
  message: string,
  code = PROJECTION_FALLBACK_ERROR.code,
  status = 200,
) {
  return NextResponse.json(
    {
      ok: false,
      data,
      error: {
        code,
        message,
        severity: PROJECTION_FALLBACK_ERROR.severity,
      },
    } satisfies ProjectionApiEnvelope<T>,
    { status },
  );
}

export function unwrapProjectionData<T>(json: unknown): T | null {
  if (json == null || typeof json !== "object") return null;
  if ("ok" in json) {
    if (!("data" in json)) return null;
    const envelope = json as ProjectionApiEnvelope<T>;
    if (envelope.data === undefined || envelope.data === null) return null;
    return envelope.data;
  }
  return json as T;
}

export function isProjectionBundleLike(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;
  return "mission" in data || "trades" in data || "pnl" in data || "evidence" in data;
}

/**
 * Unwrap API envelopes including nested bundle shapes:
 * - { ok, data: projection }
 * - { ok, data: { ok, mission, trades, ... } }
 */
export function unwrapApiData<T>(json: unknown): T | null {
  const first = unwrapProjectionData<unknown>(json);
  if (first == null) return null;
  if (isProjectionBundleLike(first)) {
    return first as T;
  }
  if (typeof first === "object" && first !== null && "data" in first) {
    const nested = unwrapProjectionData<unknown>(first);
    if (nested != null && isProjectionBundleLike(nested)) {
      return nested as T;
    }
  }
  return first as T;
}

export function isValidProjectionData<T>(data: T | null): data is T {
  return data !== null && data !== undefined;
}

export function projectionApiErrorFrom(
  err: unknown,
  code = PROJECTION_FALLBACK_ERROR.code,
): ProjectionApiErrorBody {
  return {
    code,
    message: err instanceof Error ? err.message : "Projection request failed",
    severity: "WARNING",
  };
}
