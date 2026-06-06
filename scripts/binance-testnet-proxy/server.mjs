/**
 * Binance USD-M Futures Testnet forward proxy.
 * Deploy in a non-restricted region (e.g. Singapore) when Vercel returns HTTP 451.
 *
 * Env:
 *   PORT=8787
 *   BINANCE_UPSTREAM_URL=https://demo-fapi.binance.com
 *   BINANCE_PROXY_SECRET=shared-secret (optional, must match app BINANCE_PROXY_SECRET)
 */

import http from "node:http";

const PORT = Number(process.env.PORT) || 8787;
const UPSTREAM =
  process.env.BINANCE_UPSTREAM_URL?.trim() || "https://demo-fapi.binance.com";
const PROXY_SECRET = process.env.BINANCE_PROXY_SECRET?.trim() || "";

const PRODUCTION_HOSTS = [
  "fapi.binance.com",
  "api.binance.com",
  "www.binance.com",
];

const TESTNET_HOST_MARKERS = [
  "testnet",
  "demo-fapi",
  "demo.binance",
];

function isTestnetUpstream(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    if (PRODUCTION_HOSTS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return false;
    }
    return TESTNET_HOST_MARKERS.some((m) => host.includes(m));
  } catch {
    return false;
  }
}

if (!isTestnetUpstream(UPSTREAM)) {
  console.error(
    `[binance-proxy] Refusing to start — upstream must be testnet-only: ${UPSTREAM}`,
  );
  process.exit(1);
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const REQUEST_HEADERS_TO_STRIP = new Set([
  "x-binance-proxy-secret",
  "accept-encoding",
]);

const RESPONSE_HEADERS_TO_STRIP = new Set([
  "content-encoding",
  "content-length",
]);

function copyForwardHeaders(incoming) {
  const out = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (REQUEST_HEADERS_TO_STRIP.has(lower)) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  // Prevent compressed upstream payload/header mismatch when relaying bodies.
  out["Accept-Encoding"] = "identity";
  return out;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    if (PROXY_SECRET) {
      const provided = req.headers["x-binance-proxy-secret"];
      if (provided !== PROXY_SECRET) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized proxy request" }));
        return;
      }
    }

    const path = req.url ?? "/";
    if (path === "/health" || path === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "binance-testnet-proxy",
          upstream: UPSTREAM,
          authRequired: Boolean(PROXY_SECRET),
        }),
      );
      return;
    }

    const target = new URL(path, UPSTREAM);
    const method = req.method ?? "GET";
    const body =
      method === "GET" || method === "HEAD" ? undefined : await readBody(req);

    const upstream = await fetch(target, {
      method,
      headers: copyForwardHeaders(req.headers),
      body,
      signal: AbortSignal.timeout(25_000),
    });

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower)) return;
      if (RESPONSE_HEADERS_TO_STRIP.has(lower)) return;
      responseHeaders[key] = value;
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, responseHeaders);
    res.end(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy error";
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, () => {
  console.log(
    `[binance-proxy] listening on :${PORT} → ${UPSTREAM} (auth=${Boolean(PROXY_SECRET)})`,
  );
});
