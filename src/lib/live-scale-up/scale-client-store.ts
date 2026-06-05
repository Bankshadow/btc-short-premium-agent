import type { LiveScaleStage, ScaleApprovalRecord } from "./types";
import { defaultScaleStage } from "./stage-definitions";

export const LIVE_SCALE_STAGE_KEY = "btc-desk:live-scale-stage";
export const LIVE_SCALE_HISTORY_KEY = "btc-desk:live-scale-approval-history";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadClientScaleStage(): LiveScaleStage {
  if (!isBrowser()) return defaultScaleStage();
  try {
    const raw = localStorage.getItem(LIVE_SCALE_STAGE_KEY);
    if (!raw) return defaultScaleStage();
    return raw as LiveScaleStage;
  } catch {
    return defaultScaleStage();
  }
}

export function saveClientScaleStage(stage: LiveScaleStage): void {
  if (!isBrowser()) return;
  localStorage.setItem(LIVE_SCALE_STAGE_KEY, stage);
}

export function loadClientApprovalHistory(): ScaleApprovalRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(LIVE_SCALE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScaleApprovalRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClientApprovalHistory(records: ScaleApprovalRecord[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    LIVE_SCALE_HISTORY_KEY,
    JSON.stringify(records.slice(0, 100)),
  );
}

export function appendClientApprovalRecord(
  record: ScaleApprovalRecord,
): ScaleApprovalRecord[] {
  const next = [record, ...loadClientApprovalHistory()].slice(0, 100);
  saveClientApprovalHistory(next);
  return next;
}
