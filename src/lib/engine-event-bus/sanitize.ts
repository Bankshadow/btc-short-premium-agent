const SECRET_KEY_PATTERN =
  /api[_-]?key|secret|password|token|authorization|bearer|private/i;

export function sanitizeEngineEventPayload(
  raw: Record<string, unknown> = {},
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (value == null) {
      out[key] = null;
      continue;
    }
    if (typeof value === "string") {
      if (SECRET_KEY_PATTERN.test(value) && value.length > 20) continue;
      out[key] = value.slice(0, 500);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export function sanitizeEngineEventText(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "[redacted]")
    .replace(/BINANCE_API_[A-Z_]+=\S+/gi, "[redacted]")
    .slice(0, 600);
}
