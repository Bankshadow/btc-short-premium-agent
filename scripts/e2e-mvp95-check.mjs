/**
 * MVP 95 end-to-end HTTP smoke check (run while dev server is up on :3000).
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  { path: "/api/analysis/health", required: ["ok", "status", "checks", "blockers", "warnings", "updatedAt"] },
  { path: "/api/reconciliation/status", required: ["ok", "status", "message", "orphanOpenTrades"] },
  { path: "/api/evidence-quality/status", required: ["ok", "status", "validEvidenceCount", "message"] },
  { path: "/api/exchange/binance/diagnostic", required: ["ok", "diagnostic"] },
  { path: "/api/mission/snapshot", required: ["ok", "snapshot"] },
  { path: "/api/analysis/state", required: ["ok"] },
];

function assertShape(label, data, keys) {
  for (const key of keys) {
    if (!(key in data)) {
      throw new Error(`${label}: missing field "${key}"`);
    }
  }
}

async function timedFetch(path) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  const ms = Date.now() - started;
  const data = await res.json();
  return { res, data, ms };
}

let failed = 0;

console.log(`MVP 95 E2E smoke @ ${BASE}\n`);

for (const route of ROUTES) {
  try {
    const { res, data, ms } = await timedFetch(route.path);
    if (!res.ok || data.ok === false) {
      console.log(`✖ ${route.path} HTTP ${res.status} — ${data.error ?? "not ok"}`);
      failed++;
      continue;
    }
    assertShape(route.path, data, route.required);
    const extra =
      route.path.includes("health")
        ? `status=${data.status} checks=${data.checks?.length ?? 0}`
        : route.path.includes("diagnostic")
          ? `status=${data.diagnostic?.status}`
          : route.path.includes("snapshot")
            ? `testnet=${data.snapshot?.binanceTestnet?.status}`
            : route.path.includes("evidence")
              ? `msg=${JSON.stringify(data.message)}`
              : route.path.includes("reconciliation")
                ? `msg=${JSON.stringify(data.message)}`
                : "";
    const slow = route.path.includes("health") && ms > 5000 ? " SLOW" : "";
    console.log(`✔ ${route.path} (${ms}ms)${slow} ${extra}`);
    if (route.path.includes("health") && ms > 5000) failed++;
  } catch (err) {
    console.log(`✖ ${route.path} — ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// Mission snapshot label consistency
try {
  const { data } = await timedFetch("/api/mission/snapshot");
  const s = data.snapshot;
  if (s) {
    const mcr = s.missionControllerRiskBudget?.missionMode;
    const risk = s.integratedRiskBudget?.recommendation?.mode;
    const readiness = s.microLiveReadinessReview?.readinessStatus;
    console.log(`\nMode labels: mission=${mcr ?? "—"} risk=${risk ?? "—"} readiness=${readiness ?? "—"}`);
    if (s.binanceTestnet?.status && s.binanceTestnet.status !== "CONNECTED" && !s.binanceTestnet.reason) {
      console.log("✖ binanceTestnet disconnected but missing reason");
      failed++;
    } else if (s.binanceTestnet?.status) {
      console.log(`✔ binanceTestnet ${s.binanceTestnet.status}: ${s.binanceTestnet.reason?.slice(0, 60)}…`);
    }
  }
} catch (err) {
  console.log(`✖ mission snapshot labels — ${err instanceof Error ? err.message : err}`);
  failed++;
}

console.log(failed === 0 ? "\nAll E2E checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
