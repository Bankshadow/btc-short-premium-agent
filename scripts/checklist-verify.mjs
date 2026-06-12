const BASE = process.env.E2E_BASE ?? "https://btc-short-premium-agent.vercel.app";

async function req(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const checklist = [];

function mark(item, ok, detail) {
  checklist.push({ item, ok, detail });
  console.log(`${ok ? "✅" : "❌"} [${item}] ${detail}`);
}

async function main() {
  console.log(`\nChecklist verify @ ${BASE}\n`);

  const status = await req("/api/binance/status");
  const binance = status.json?.data ?? status.json;
  mark(
    "Binance status = CONNECTED",
    binance?.status === "CONNECTED",
    `status=${binance?.status ?? "?"}`,
  );
  mark(
    "Base URL แสดงถูกต้อง",
    binance?.baseUrl === "https://demo-fapi.binance.com",
    `baseUrl=${binance?.baseUrl ?? "—"}`,
  );

  const run = await req("/api/analysis/run", { method: "POST" });
  const { runId, decisionLogId, previewId } = run.json ?? {};
  mark(
    "Start AI สร้าง runId + decisionLogId",
    Boolean(runId && decisionLogId),
    `runId=${runId ?? "—"}, decisionLogId=${decisionLogId ?? "—"}`,
  );
  mark(
    "Preview created",
    Boolean(previewId),
    `previewId=${previewId ?? "—"}`,
  );

  if (!previewId) {
    console.log("\nStopped — no previewId");
    process.exit(1);
  }

  const review = await req("/api/execution/review", {
    method: "POST",
    body: JSON.stringify({ previewId, doubleConfirm: true }),
  });
  mark(
    "Safety gate passed",
    review.json?.allowed === true,
    review.json?.allowed ? "allowed=true" : JSON.stringify(review.json?.blockers?.map((b) => b.code)),
  );

  const exec = await req("/api/execution/testnet/execute", {
    method: "POST",
    body: JSON.stringify({ previewId, doubleConfirm: true }),
  });
  mark(
    "Execute testnet order สำเร็จ",
    exec.json?.ok === true && Boolean(exec.json?.orderId),
    exec.json?.ok ? `orderId=${exec.json.orderId}` : exec.json?.message ?? JSON.stringify(exec.json),
  );

  const events = await req("/api/journal/events?limit=50");
  const eventList = events.json?.events ?? [];
  const types = new Set(eventList.map((e) => e.type));
  mark("ORDER_EXECUTED event", types.has("ORDER_EXECUTED"), `found=${types.has("ORDER_EXECUTED")}`);
  mark("POSITION_OPENED event", types.has("POSITION_OPENED"), `found=${types.has("POSITION_OPENED")}`);

  const trades = await req("/api/trades");
  mark(
    "Trades มี OPEN trade",
    trades.json?.summary?.openCount >= 1,
    `openCount=${trades.json?.summary?.openCount ?? 0}`,
  );

  const reports = await req("/api/reports/summary");
  const reportsOk =
    reports.status === 200 &&
    reports.json &&
    !reports.json.error &&
    reports.json.executionStats?.openTradesCount >= 1;
  mark(
    "Reports ไม่ Loading และเห็น openTrades = 1",
    reportsOk,
    reports.json?.executionStats
      ? `openTrades=${reports.json.executionStats.openTradesCount}, HTTP ${reports.status}`
      : `HTTP ${reports.status} ${JSON.stringify(reports.json)?.slice(0, 120)}`,
  );

  const failed = checklist.filter((c) => !c.ok);
  console.log(`\n--- ${checklist.length - failed.length}/${checklist.length} passed ---\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
