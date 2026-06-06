import { BACKBONE_CLIENT_ID_KEY, BACKBONE_STORAGE_KEY } from "../config";
import type { DeskBackboneRecord } from "../types";

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "server-anonymous";
  try {
    const existing = localStorage.getItem(BACKBONE_CLIENT_ID_KEY);
    if (existing) return existing;
    const id = `desk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(BACKBONE_CLIENT_ID_KEY, id);
    return id;
  } catch {
    return "local-fallback";
  }
}

export function readLocalBackbone(): DeskBackboneRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BACKBONE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeskBackboneRecord;
  } catch {
    return null;
  }
}

export function writeLocalBackbone(record: DeskBackboneRecord): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(BACKBONE_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
