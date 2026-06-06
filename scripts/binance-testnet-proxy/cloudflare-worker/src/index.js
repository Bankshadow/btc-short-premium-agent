/**
 * Binance USD-M Futures Testnet forward proxy (Cloudflare Worker).
 * Free tier — no credit card required for *.workers.dev
 *
 * Env (wrangler secret put BINANCE_PROXY_SECRET):
 *   BINANCE_PROXY_SECRET — optional shared secret (must match Vercel)
 */

const UPSTREAM = "https://demo-fapi.binance.com";

const PRODUCTION_HOSTS = [
  "fapi.binance.com",
  "api.binance.com",
  "www.binance.com",
];

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
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "x-forwarded-proto",
  "x-real-ip",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isHealth = url.pathname === "/health" || url.pathname === "/";

    const secret = env.BINANCE_PROXY_SECRET?.trim() || "";
    if (secret && !isHealth) {
      const provided = request.headers.get("x-binance-proxy-secret");
      if (provided !== secret) {
        return Response.json({ error: "Unauthorized proxy request" }, { status: 401 });
      }
    }

    if (isHealth) {
      return Response.json({
        ok: true,
        service: "binance-testnet-proxy",
        platform: "cloudflare-worker",
        upstream: UPSTREAM,
        authRequired: Boolean(secret),
      });
    }

    const target = new URL(url.pathname + url.search, UPSTREAM);
    const host = target.hostname.toLowerCase();
    if (PRODUCTION_HOSTS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return Response.json({ error: "Production Binance hosts are blocked." }, { status: 403 });
    }

    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower)) continue;
      if (REQUEST_HEADERS_TO_STRIP.has(lower)) continue;
      headers.set(key, value);
    }
    headers.set("Accept-Encoding", "identity");

    const method = request.method;
    const body =
      method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

    try {
      const upstream = await fetch(target.toString(), {
        method,
        headers,
        body,
        redirect: "follow",
      });

      const outHeaders = new Headers();
      upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP.has(lower)) return;
        if (lower === "content-encoding" || lower === "content-length") return;
        outHeaders.set(key, value);
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: outHeaders,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Proxy error";
      return Response.json({ error: message }, { status: 502 });
    }
  },
};
