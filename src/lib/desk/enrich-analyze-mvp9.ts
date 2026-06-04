import type { AnalyzeApiResponse } from "@/lib/types/market";
import { runDeskNarrator } from "@/lib/llm/desk-narrator";

/** Attach MVP 9 narrator (server-only; never changes verdict). */
export async function enrichAnalyzeWithMvp9(
  data: AnalyzeApiResponse,
  options?: { locale?: "th" | "en"; includeNarrator?: boolean },
): Promise<AnalyzeApiResponse> {
  if (options?.includeNarrator === false) return data;
  const narrator = await runDeskNarrator(data, { locale: options?.locale ?? "th" });
  return { ...data, deskNarrator: narrator };
}
