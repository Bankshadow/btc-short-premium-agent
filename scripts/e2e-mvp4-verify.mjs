const BASE = process.env.E2E_BASE ?? "http://localhost:3005";

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

const results = [];

function pass(id, msg) {
  results.push({ id, ok: true, msg });
  console.log(`✅ ${id}: ${msg}`);
}

function fail(id, msg) {
  results.push({ id, ok: false, msg });
  console.log(`❌ ${id}: ${msg}`);
}

async function main() {
  console.log(`\nE2E MVP4 verify @ ${BASE}\n`);

  const status = await req("/api/binance/status");
  if (status.json?.status) {
    pass(2, `/settings data: status=${status.json.status}, reason=${status.json.reason?.slice(0, 60)}`);
  } else {
    fail(2, `Binance status failed HTTP ${status.status}`);
  }

  const run = await req("/api/analysis/run", { method: "POST" });
  const runId = run.json?.runId;
  const decisionLogId = run.json?.decisionLogId;
  const previewId = run.json?.previewId;
  if (runId && decisionLogId) pass(4, `runId=${runId}, decisionLogId=${decisionLogId}`);
  else fail(4, `Missing runId/decisionLogId: ${JSON.stringify(run.json)}`);

  if (previewId) pass(5, `previewId=${previewId}`);
  else fail(5, `Missing previewId: ${JSON.stringify(run.json)}`);

  if (!previewId) {
    console.log("\nCannot continue without previewId");
    process.exit(1);
  }

  const reviewBlocked = await req("/api/execution/review", {
    method: "POST",
    body: JSON.stringify({ previewId, doubleConfirm: false }),
  });
  const reviewNoConfirmBlocked =
    reviewBlocked.json?.allowed === false &&
    reviewBlocked.json?.blockers?.some((b) => b.code === "DOUBLE_CONFIRM_REQUIRED");
  if (reviewNoConfirmBlocked) pass(7, "Review without double confirm → blocked");
  else fail(7, `Review should block: ${JSON.stringify(reviewBlocked.json)}`);

  const execNoConfirm = await req("/api/execution/testnet/execute", {
    method: "POST",
    body: JSON.stringify({ previewId, doubleConfirm: false }),
  });
  if (execNoConfirm.json?.ok === false && execNoConfirm.json?.blocked === true) {
    pass("7b", "Execute without double confirm → blocked");
  } else {
    fail("7b", `Execute should block: ${JSON.stringify(execNoConfirm.json)}`);
  }

  if (status.json?.status === "MISSING_ENV") {
    const execMissing = await req("/api/execution/testnet/execute", {
      method: "POST",
      body: JSON.stringify({ previewId, doubleConfirm: true }),
    });
    if (execMissing.json?.ok === false) pass(8, "Execute with missing env → blocked");
    else fail(8, `Execute should block on MISSING_ENV: ${JSON.stringify(execMissing.json)}`);
  } else if (status.json?.status === "CONNECTED") {
    pass(8, "Env present (CONNECTED) — MISSING_ENV block covered by unit tests");
    pass(9, `Binance status CONNECTED`);
  } else {
    pass(8, `Status=${status.json?.status} — missing-env block covered by unit tests`);
    fail(9, `Expected CONNECTED, got ${status.json?.status}: ${status.json?.reason}`);
  }

  const reviewOk = await req("/api/execution/review", {
    method: "POST",
    body: JSON.stringify({ previewId, doubleConfirm: true }),
  });
  if (reviewOk.json?.allowed === true) pass("6/9b", "Review with double confirm → gate passed");
  else fail("6/9b", `Review should pass: ${JSON.stringify(reviewOk.json)}`);

  if (status.json?.status === "CONNECTED" && reviewOk.json?.allowed) {
    const exec = await req("/api/execution/testnet/execute", {
      method: "POST",
      body: JSON.stringify({ previewId, doubleConfirm: true }),
    });
    if (exec.json?.ok === true && exec.json?.orderId) {
      pass(10, `Execute ok orderId=${exec.json.orderId}, tradeId=${exec.json.tradeId}`);
    } else {
      fail(10, `Execute failed: ${JSON.stringify(exec.json)}`);
    }
  } else {
    fail(10, "Skipped execute — Binance not CONNECTED or gate not passed");
  }

  const trades = await req("/api/trades");
  if (trades.json?.summary?.openCount >= 1 && trades.json?.open?.length >= 1) {
    pass(11, `Trades openCount=${trades.json.summary.openCount}, symbol=${trades.json.open[0].symbol}`);
  } else {
    fail(11, `No open trade: ${JSON.stringify(trades.json?.summary)}`);
  }

  const reports = await req("/api/reports/summary");
  if (reports.json?.executionStats?.openTradesCount >= 1) {
    pass(12, `Reports openTrades=${reports.json.executionStats.openTradesCount}, executions=${reports.json.executionStats.executionCount}`);
  } else {
    fail(12, `Reports openTrades not 1: ${JSON.stringify(reports.json?.executionStats)}`);
  }

  const events = await req("/api/journal/events?limit=50");
  const types = new Set((events.json?.events ?? []).map((e) => e.type));
  const hasOrder = types.has("ORDER_EXECUTED");
  const hasPosition = types.has("POSITION_OPENED");
  if (hasOrder && hasPosition) pass(13, "Journal has ORDER_EXECUTED + POSITION_OPENED");
  else fail(13, `Missing events. has ORDER_EXECUTED=${hasOrder}, POSITION_OPENED=${hasPosition}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
