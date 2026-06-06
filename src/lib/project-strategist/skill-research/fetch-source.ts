import type { StrategistExternalSource } from "@/lib/project-strategist/types";
import { clampText, inferSourceTitle, sanitizeSourceText } from "./utils";

export async function fetchExternalSourceContent(input: {
  sourceUrl: string;
  title?: string;
}): Promise<StrategistExternalSource> {
  const now = new Date().toISOString();
  const base: StrategistExternalSource = {
    sourceId: "",
    sourceUrl: input.sourceUrl,
    title: inferSourceTitle({
      sourceUrl: input.sourceUrl,
      sourceContent: null,
      fallback: input.title,
    }),
    sourceContent: null,
    fetchStatus: "ADDED",
    addedAt: now,
    updatedAt: now,
    lastError: null,
  };

  try {
    const response = await fetch(input.sourceUrl, {
      method: "GET",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BTCProjectStrategist/1.0; analysis-only)",
      },
    });
    if (!response.ok) {
      return {
        ...base,
        fetchStatus: "FETCH_FAILED",
        lastError: `Fetch failed: HTTP ${response.status}`,
      };
    }
    const text = await response.text();
    const cleaned = clampText(sanitizeSourceText(text), 6000);
    return {
      ...base,
      sourceContent: cleaned || null,
      fetchStatus: cleaned ? "FETCHED" : "FETCH_FAILED",
      lastError: cleaned ? null : "Fetched empty source content.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source fetch failed";
    return {
      ...base,
      fetchStatus: "FETCH_FAILED",
      lastError: message,
    };
  }
}
