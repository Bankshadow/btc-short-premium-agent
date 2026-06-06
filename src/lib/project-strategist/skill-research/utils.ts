export function sanitizeSourceText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampText(input: string, max = 4000): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...`;
}

export function inferSourceTitle(input: {
  sourceUrl: string | null;
  sourceContent: string | null;
  fallback?: string;
}): string {
  if (input.fallback?.trim()) return input.fallback.trim();
  if (input.sourceUrl) {
    try {
      const url = new URL(input.sourceUrl);
      return `${url.hostname}${url.pathname}`;
    } catch {
      return input.sourceUrl;
    }
  }
  if (input.sourceContent?.trim()) {
    return input.sourceContent.trim().slice(0, 80);
  }
  return "External source";
}
