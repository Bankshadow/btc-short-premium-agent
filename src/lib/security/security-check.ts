const SENSITIVE_KEYS = ["apiSecret", "secret", "password", "token", "api_key", "apikey"];

export function redactSecrets(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}

import type { SecurityCheckResult } from "@/lib/audit/audit-types";

export async function runSecurityCheck(): Promise<SecurityCheckResult> {
  const { appendEvent } = await import("@/lib/journal/journal-query");
  const issues: Array<{ code: string; message: string }> = [];

  if (process.env.BINANCE_API_SECRET?.trim()) {
    issues.push({ code: "SECRET_IN_ENV", message: "API secret present in env (expected server-side only)." });
  }
  if (process.env.BINANCE_LIVE_ENABLED?.trim().toLowerCase() === "true") {
    issues.push({ code: "LIVE_FLAG_SET", message: "Live flag set — execution remains policy-locked." });
  }

  const result = {
    checkedAt: new Date().toISOString(),
    passed: issues.length === 0,
    issues,
    secretsRedacted: true as const,
  };

  await appendEvent({
    type: "SECURITY_CHECK_COMPLETED",
    environment: "testnet",
    payload: redactSecrets(result) as Record<string, unknown>,
  });

  return result;
}
