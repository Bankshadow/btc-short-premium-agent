/**
 * Run full testnet evidence collection loop toward 12 valid trades.
 *
 * Usage:
 *   node scripts/run-testnet-evidence-collector.mjs
 *   E2E_BASE_URL=https://btc-short-premium-agent.vercel.app node scripts/run-testnet-evidence-collector.mjs
 *   TARGET_VALID=12 MAX_CYCLES=24 node scripts/run-testnet-evidence-collector.mjs
 *
 * Requires server with BINANCE_TESTNET_ENABLED + keys. Uses testnet-only APIs;
 * live trading remains locked. Every execute/close sends doubleConfirm: true.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const TARGET_VALID = Number(process.env.TARGET_VALID ?? 12);
const MAX_CYCLES = Number(process.env.MAX_CYCLES ?? 24);
const PAUSE_MS = Number(process.env.CYCLE_PAUSE_MS ?? 8_000);

async function fetchJson(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

async function getEvidenceCount() {
  const { data } = await fetchJson("/api/evidence-quality/status");
  return {
    valid: data.validEvidenceCount ?? 0,
    required: data.requiredEvidenceCount ?? 12,
    message: data.message ?? "",
    status: data.status ?? "UNKNOWN",
  };
}

async function getDiagnostic() {
  const { data } = await fetchJson("/api/exchange/binance/diagnostic");
  return data.diagnostic ?? null;
}

async function getOpenPositions() {
  const { data } = await fetchJson("/api/exchange/binance/positions");
  const positions = Array.isArray(data.positions) ? data.positions : [];
  return positions.filter((p) => Math.abs(Number(p.positionAmt)) > 0);
}

async function runAutomationCycle() {
  const { res, data } = await fetchJson("/api/automation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trigger: "manual", force: true }),
  });
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? data.result?.error ?? `Automation HTTP ${res.status}`);
  }
  return data.result;
}

async function runAnalysis() {
  const { res, data } = await fetchJson("/api/analysis/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trigger: "manual", createTestnetPreview: true }),
  });
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? `Analysis HTTP ${res.status}`);
  }
  return data;
}

async function executePreview(previewId) {
  const { res, data } = await fetchJson("/api/exchange/binance/testnet/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previewId, doubleConfirm: true }),
  });
  return { ok: res.ok && data.ok !== false, data };
}

async function closeSymbol(symbol) {
  const { res, data } = await fetchJson("/api/testnet-monitor/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, doubleConfirm: true, operatorNote: "Evidence collector close" }),
  });
  return { ok: res.ok && data.ok !== false, data };
}

async function refreshSnapshot() {
  await fetchJson("/api/testnet-monitor/refresh", { method: "POST" }).catch(() => null);
  await fetchJson("/api/analysis/consistency/fix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applyRecommended: true }),
  }).catch(() => null);
}

async function clearLoopGuard() {
  const { res, data } = await fetchJson("/api/autopilot-loop-guard/clear", {
    method: "POST",
  });
  if (res.ok && data.ok !== false) {
    log("prep", "Loop guard cleared");
  }
}

async function getPendingPreview() {
  const { data } = await fetchJson("/api/mission/snapshot");
  const preview = data.snapshot?.pendingTestnetPreview ?? data.pendingTestnetPreview ?? null;
  return preview && !preview.blocked ? preview : null;
}

async function prepCycle() {
  await clearLoopGuard();
  await refreshSnapshot();
  const pending = await getPendingPreview();
  if (pending?.previewId) {
    log("execute", `Pending preview ${pending.previewId} (${pending.symbol} ${pending.side})…`);
    const exec = await executePreview(pending.previewId);
    log("execute", exec.ok ? `filled ${pending.previewId}` : exec.data.error ?? "blocked");
    await sleep(3_000);
    await refreshSnapshot();
  }
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function closeAllOpenPositions() {
  const open = await getOpenPositions();
  for (const pos of open) {
    log("close", `${pos.symbol} reduce-only…`);
    const outcome = await closeSymbol(pos.symbol);
    if (!outcome.ok) {
      log("close", `blocked: ${outcome.data.error ?? JSON.stringify(outcome.data)}`);
    } else {
      log("close", `submitted ${pos.symbol}`);
    }
    await sleep(2_000);
    await refreshSnapshot();
  }
}

async function main() {
  console.log(`Testnet evidence collector @ ${BASE}`);
  console.log(`Target: ${TARGET_VALID} valid trades · max cycles: ${MAX_CYCLES}\n`);

  const diag = await getDiagnostic();
  if (!diag?.connected) {
    console.error(`Binance testnet not connected: ${diag?.status ?? "UNKNOWN"} — ${diag?.reason ?? ""}`);
    console.error(`Recommendation: ${diag?.recommendation ?? "Check env keys and proxy."}`);
    process.exit(1);
  }
  log("diagnostic", `CONNECTED · ${diag.baseUrl}`);

  let evidence = await getEvidenceCount();
  log("evidence", `${evidence.valid}/${evidence.required} valid — ${evidence.message}`);

  for (let cycle = 1; cycle <= MAX_CYCLES && evidence.valid < TARGET_VALID; cycle += 1) {
    console.log(`\n--- Cycle ${cycle}/${MAX_CYCLES} ---`);

    await prepCycle();

    try {
      log("automation", "Running automation cycle (analyze → autoexecute → monitor)…");
      const automation = await runAutomationCycle();
      log(
        "automation",
        `${automation.status} · ${automation.summary ?? `${automation.jobs?.length ?? 0} job(s)`}`,
      );
      if (automation.status === "SKIPPED") {
        throw new Error("Automation skipped — falling back to manual analysis/execute");
      }
    } catch (err) {
      log("automation", `fallback to analysis/run — ${err instanceof Error ? err.message : err}`);
      try {
        const analysis = await runAnalysis();
        log("analysis", `verdict ${analysis.result?.finalVerdict ?? "—"} · preview ${analysis.previewId ?? "none"}`);
        if (analysis.previewId) {
          const exec = await executePreview(analysis.previewId);
          log("execute", exec.ok ? `filled ${analysis.previewId}` : exec.data.error ?? "blocked");
        }
      } catch (analysisErr) {
        log("analysis", analysisErr instanceof Error ? analysisErr.message : String(analysisErr));
      }
    }

    await sleep(PAUSE_MS);

    const open = await getOpenPositions();
    if (open.length > 0) {
      log("monitor", `${open.length} open position(s) — force close for evidence collection`);
      await closeAllOpenPositions();
      await sleep(PAUSE_MS);
      await closeAllOpenPositions();
    } else {
      log("monitor", "No open positions");
    }

    await refreshSnapshot();
    evidence = await getEvidenceCount();
    log("evidence", `${evidence.valid}/${evidence.required} valid — ${evidence.message}`);

    if (evidence.valid >= TARGET_VALID) break;
  }

  console.log("\n=== Done ===");
  evidence = await getEvidenceCount();
  console.log(`Valid evidence: ${evidence.valid}/${evidence.required} (${evidence.status})`);
  if (evidence.valid < TARGET_VALID) {
    console.log(`Did not reach ${TARGET_VALID} within ${MAX_CYCLES} cycles.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
