import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { WarehouseBackend } from "./types";

export function resolveWarehouseBackend(): WarehouseBackend {
  if (isSupabaseConfigured()) return "supabase";
  return "file";
}

export function isWarehouseConfigured(): boolean {
  return resolveWarehouseBackend() !== "none";
}
