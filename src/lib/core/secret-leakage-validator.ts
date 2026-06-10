import { redactSecrets } from "@/lib/security/security-check";
import type { EventValidationIssue } from "./core-errors";

export const FORBIDDEN_SECRET_KEYS = [
  "apiKey",
  "apiSecret",
  "secret",
  "signature",
  "x-mbx-apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "privateKey",
  "passphrase",
] as const;

const FORBIDDEN_KEY_PATTERN = new RegExp(
  FORBIDDEN_SECRET_KEYS.map((k) => k.replace(/[-]/g, "[-_]?")).join("|"),
  "i",
);

const BINANCE_SIGNATURE_PATTERN = /\b[a-f0-9]{64}\b/i;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9+/=_-]{48,}\b/;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i;
const BASIC_AUTH_PATTERN = /Basic\s+[A-Za-z0-9+/=]+/i;
const LIVE_LEAK_PATTERN = /"liveEnabled"\s*:\s*true|"environment"\s*:\s*"live"/i;

export interface SecretLeakageResult {
  issues: EventValidationIssue[];
  hasCritical: boolean;
}

function critical(
  code: string,
  message: string,
  field?: string,
  requiredAction?: string,
): EventValidationIssue {
  return { code, message, severity: "CRITICAL", field, requiredAction };
}

function walkObjectFixed(
  value: unknown,
  path: string,
  onKey: (key: string, fullPath: string) => void,
  onString: (str: string, fullPath: string) => void,
): void {
  if (value == null) return;
  if (typeof value === "string") {
    onString(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkObjectFixed(item, `${path}[${i}]`, onKey, onString));
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${k}` : k;
      onKey(k, fullPath);
      walkObjectFixed(v, fullPath, onKey, onString);
    }
  }
}

export function validateSecretLeakage(
  payload: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
): SecretLeakageResult {
  const issues: EventValidationIssue[] = [];
  const roots: Array<{ label: string; data: Record<string, unknown> | undefined }> = [
    { label: "payload", data: payload },
    { label: "metadata", data: metadata },
  ];

  for (const { label, data } of roots) {
    if (!data) continue;

    walkObjectFixed(
      data,
      label,
      (key, fullPath) => {
        if (FORBIDDEN_KEY_PATTERN.test(key)) {
          issues.push(
            critical(
              "SECRET_KEY_FORBIDDEN",
              `Forbidden secret-related key "${key}" at ${fullPath}.`,
              fullPath,
              "Remove secret fields before appending to journal.",
            ),
          );
        }
      },
      (str, fullPath) => {
        if (BEARER_TOKEN_PATTERN.test(str)) {
          issues.push(
            critical(
              "BEARER_TOKEN_DETECTED",
              `Bearer token pattern detected at ${fullPath}.`,
              fullPath,
              "Redact authorization headers; never store in journal.",
            ),
          );
        }
        if (BASIC_AUTH_PATTERN.test(str)) {
          issues.push(
            critical(
              "BASIC_AUTH_DETECTED",
              `Basic auth pattern detected at ${fullPath}.`,
              fullPath,
              "Redact credentials before journaling.",
            ),
          );
        }
        if (BINANCE_SIGNATURE_PATTERN.test(str) && /signature/i.test(fullPath)) {
          issues.push(
            critical(
              "SIGNATURE_VALUE_DETECTED",
              `Binance-like signature hash at ${fullPath}.`,
              fullPath,
              "Do not persist request signatures.",
            ),
          );
        }
        const idPath =
          /eventId|runId|tradeId|decisionLogId|previewId|positionId|closePreviewId|reportId|swarmId/i;
        if (LONG_TOKEN_PATTERN.test(str) && !idPath.test(fullPath)) {
          issues.push(
            critical(
              "SUSPICIOUS_TOKEN",
              `Suspicious long token at ${fullPath}.`,
              fullPath,
              "Verify this is not an API key or secret.",
            ),
          );
        }
      },
    );

    const json = JSON.stringify(data);
    if (LIVE_LEAK_PATTERN.test(json)) {
      issues.push(
        critical(
          "LIVE_TRADING_LEAK",
          "Payload or metadata indicates live trading enabled.",
          label,
          "Live trading remains policy-locked; remove live flags.",
        ),
      );
    }
  }

  if (payload) {
    const json = JSON.stringify(payload);
    const redacted = redactSecrets(payload) as Record<string, unknown>;
    if (JSON.stringify(redacted) !== json) {
      issues.push(
        critical(
          "SECRET_VALUE_REDACTABLE",
          "Payload contains redactable secret values.",
          "payload",
          "Remove or redact secret values before append.",
        ),
      );
    }
  }

  return { issues, hasCritical: issues.length > 0 };
}
