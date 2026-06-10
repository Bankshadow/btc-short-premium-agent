import crypto from "node:crypto";

export function signQuery(query: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

export function buildSignedQuery(
  params: Record<string, string | number | boolean | undefined>,
  secret: string,
  timestamp = Date.now(),
): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const query = [...entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`), `timestamp=${timestamp}`].join(
    "&",
  );
  const signature = signQuery(query, secret);
  return `${query}&signature=${signature}`;
}
