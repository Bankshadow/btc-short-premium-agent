const SECRET_KEY_PATTERNS = [
  /api[_-]?key/i,
  /api[_-]?secret/i,
  /secret/i,
  /token/i,
  /password/i,
  /bearer/i,
  /authorization/i,
  /cron[_-]?secret/i,
  /webhook/i,
  /private[_-]?key/i,
  /credentials/i,
];

const SECRET_VALUE_PATTERNS = [
  /(api[_-]?key|api[_-]?secret|secret|token|password|bearer)\s*[=:]\s*\S+/gi,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
];

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((p) => p.test(key));
}

export function sanitizeStringValue(value: string): string {
  let safe = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    safe = safe.replace(pattern, "[redacted]");
  }
  return safe;
}

export function sanitizeRecordValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeStringValue(value) as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRecordValue(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = sanitizeRecordValue(child);
  }
  return out as T;
}
