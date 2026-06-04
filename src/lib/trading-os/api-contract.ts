export interface ApiEndpointDoc {
  method: string;
  path: string;
  summary: string;
  auth: string;
  requestBody?: string;
  query?: string;
  response: string;
  notes: string[];
}

export const TRADING_OS_API_CONTRACT: ApiEndpointDoc[] = [
  {
    method: "POST",
    path: "/api/analyze",
    summary: "Run full 6-step playbook + multi-agent trading desk",
    auth: "None (public read-only market data). Optional body overrides.",
    requestBody: `Partial DecisionEngineInput & AnalysisInput: macroView, macroEvent, derivativesOverrides, deskMemory, ethQuote, deskRiskProfile, strategyRegistry, governance`,
    response: "AnalyzeApiResponse — steps 1–6, tradingDesk, sourceErrors",
    notes: [
      "Analysis only — does not place exchange orders.",
      "Send strategyRegistry + governance from browser for committee gates.",
    ],
  },
  {
    method: "GET",
    path: "/api/market",
    summary: "Live BTC (+ optional ETH) spot snapshot",
    auth: "None",
    response: "{ btc, eth?, timestamp }",
    notes: ["Bybit public ticker."],
  },
  {
    method: "GET",
    path: "/api/paper/orders",
    summary: "List paper orders from Supabase when configured",
    auth: "None",
    query: "?status=open — open positions only",
    response: "{ ok, orders, openOrders, source }",
    notes: ["Falls back to hint for local-only storage."],
  },
  {
    method: "POST",
    path: "/api/paper/sync",
    summary: "Upsert paper orders to cloud journal",
    auth: "None",
    requestBody: "{ orders, settings }",
    response: "{ ok, synced, openOrders? }",
    notes: ["Requires SUPABASE_* env on server."],
  },
  {
    method: "GET | POST",
    path: "/api/journal/sync",
    summary: "Pull or push decision log entries",
    auth: "None",
    requestBody: "POST: { entries: DecisionLogEntry[] }",
    response: "GET: { pulled } · POST: { synced }",
    notes: ["Browser is source of truth when Supabase off."],
  },
  {
    method: "GET",
    path: "/api/desk/status",
    summary: "Desk integrations and API index",
    auth: "None",
    response: "{ ok, riskProfile, integrations, apis }",
    notes: ["Lightweight monitor endpoint."],
  },
  {
    method: "GET",
    path: "/api/desk/health",
    summary: "Operator health snapshot (open paper count when DB on)",
    auth: "None",
    response: "{ ok, health }",
    notes: ["Uses buildDeskHealth."],
  },
  {
    method: "POST",
    path: "/api/alerts/test",
    summary: "Send test Telegram/Discord desk alert",
    auth: "None",
    requestBody: "{ discordWebhookUrl? }",
    response: "{ telegramSent, discordSent, errors? }",
    notes: ["Requires TELEGRAM_* or webhook env / body URL."],
  },
];

export const TRADING_OS_DISCLAIMER =
  "AI Trading Desk OS — no fully automatic live trading. Semi-live paths require human approval. No private exchange keys in this MVP.";
