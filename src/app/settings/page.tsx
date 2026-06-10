"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/api/fetch-json";
import { Badge, LoadingOrError, useApi } from "@/components/use-api";
import { BinanceTestnetDiagnosticsPanel } from "@/components/BinanceTestnetDiagnosticsPanel";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import type { EngineHealthReport } from "@/lib/health/engine-health-types";
import type { LiveSandboxStatus } from "@/lib/live-sandbox/live-sandbox-types";
import type { ProductionHealthResult, SecurityCheckResult } from "@/lib/audit/audit-types";

interface BinanceStatusResponse extends BinanceStatusDiagnostics {
  killSwitch: { active: boolean; reason: string | null };
  limits: { maxNotionalUsd: number; allowedSymbols: string[] };
}

function healthTone(status: string): "safe" | "blocked" | "wait" {
  if (status === "OK") return "safe";
  if (status === "WARNING") return "wait";
  return "blocked";
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<BinanceStatusResponse>("/api/binance/status");
  const {
    data: health,
    error: healthError,
    loading: healthLoading,
    reload: reloadHealth,
  } = useApi<EngineHealthReport>("/api/health/engine");
  const { data: sandbox, reload: reloadSandbox } = useApi<LiveSandboxStatus>(
    "/api/live-sandbox/status",
  );
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [runningProduction, setRunningProduction] = useState(false);
  const [runningSecurity, setRunningSecurity] = useState(false);
  const [productionResult, setProductionResult] = useState<ProductionHealthResult | null>(null);
  const [securityResult, setSecurityResult] = useState<SecurityCheckResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runHealthCheck() {
    setCheckingHealth(true);
    setActionError(null);
    try {
      await fetchJson("/api/health/check", { method: "POST" });
      reloadHealth();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setCheckingHealth(false);
    }
  }

  async function runProductionHealthCheck() {
    setRunningProduction(true);
    setActionError(null);
    try {
      const res = await fetchJson<{ health: ProductionHealthResult }>("/api/production/health-check", {
        method: "POST",
      });
      setProductionResult(res.health);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Production health check failed");
    } finally {
      setRunningProduction(false);
    }
  }

  async function runSecurityCheck() {
    setRunningSecurity(true);
    setActionError(null);
    try {
      const res = await fetchJson<{ security: SecurityCheckResult }>("/api/security/check", {
        method: "POST",
      });
      setSecurityResult(res.security);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Security check failed");
    } finally {
      setRunningSecurity(false);
    }
  }

  const pending = LoadingOrError({ loading, error, onRetry: reload });
  if (pending) return pending;
  if (!data) return <p className="empty-state">No settings data.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-sm text-[var(--muted)]">MVP 24 · Testnet config &amp; production hardening</p>
        </div>
        <button type="button" className="btn" onClick={() => { reload(); reloadSandbox(); }}>
          Refresh
        </button>
      </div>

      {actionError ? <div className="error-box">{actionError}</div> : null}

      <BinanceTestnetDiagnosticsPanel data={data} title="Binance testnet" />

      <div className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Engine health diagnostics</h3>
          <button
            type="button"
            className="btn"
            disabled={checkingHealth}
            onClick={runHealthCheck}
          >
            {checkingHealth ? "Checking…" : "Run health check"}
          </button>
        </div>
        {healthLoading ? (
          <p className="text-sm text-[var(--muted)]">Loading health report…</p>
        ) : healthError ? (
          <p className="text-sm text-[var(--danger)]">{healthError}</p>
        ) : health ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone={healthTone(health.status)}>{health.status}</Badge>
              {health.blocksExecution ? (
                <Badge tone="blocked">Execution blocked</Badge>
              ) : (
                <Badge tone="safe">Execution allowed</Badge>
              )}
            </div>
            <p className="text-sm text-[var(--muted)]">{health.message}</p>
            <p className="text-xs text-[var(--muted)]">
              Checked {new Date(health.checkedAt).toLocaleString()}
            </p>
            {health.issues.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {health.issues.map((i) => (
                  <li key={i.code}>
                    <span className="font-mono">{i.code}</span> — {i.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">No health report available.</p>
        )}
      </div>

      <div className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Production health</h3>
          <button
            type="button"
            className="btn"
            disabled={runningProduction}
            onClick={runProductionHealthCheck}
          >
            {runningProduction ? "Checking…" : "Run production health check"}
          </button>
        </div>
        {productionResult ? (
          <>
            <Badge tone={healthTone(productionResult.status)}>{productionResult.status}</Badge>
            <Badge tone={productionResult.recommendation === "NOT_READY" ? "wait" : "safe"}>
              {productionResult.recommendation}
            </Badge>
            {productionResult.issues.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {productionResult.issues.map((i) => (
                  <li key={i.code}>
                    <span className="font-mono">{i.code}</span> — {i.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">No production issues detected.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Run a production health check to assess hardening.</p>
        )}
      </div>

      <div className="panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Security check</h3>
          <button
            type="button"
            className="btn"
            disabled={runningSecurity}
            onClick={runSecurityCheck}
          >
            {runningSecurity ? "Checking…" : "Run security check"}
          </button>
        </div>
        {securityResult ? (
          <>
            <Badge tone={securityResult.passed ? "safe" : "wait"}>
              {securityResult.passed ? "PASSED" : "ISSUES FOUND"}
            </Badge>
            {securityResult.issues.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {securityResult.issues.map((i) => (
                  <li key={i.code}>
                    <span className="font-mono">{i.code}</span> — {i.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">No security issues flagged.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Run a security check to verify env policy.</p>
        )}
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Live trading</h3>
        <Badge tone="safe">Live locked</Badge>
        {data.liveEnabled ? (
          <p className="text-sm text-[var(--danger)]">
            Live env flag detected — v2 execution remains blocked.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">BINANCE_LIVE_ENABLED=false (required).</p>
        )}
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Live sandbox</h3>
        {sandbox ? (
          <>
            <Badge tone="safe">Dry-run only</Badge>
            <p className="text-sm text-[var(--muted)]">{sandbox.message}</p>
            {sandbox.blockers.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-[var(--muted)]">
                {sandbox.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading sandbox status…</p>
        )}
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Execution policy</h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone="safe">Manual confirm only</Badge>
          <Badge tone="safe">Auto-execute off</Badge>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Execute requires double confirm and a passed safety gate. Engine BLOCKED status prevents
          new orders and closes.
        </p>
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Risk limits</h3>
        <p className="text-sm">Max notional: ${data.limits.maxNotionalUsd}</p>
        <p className="text-sm text-[var(--muted)]">
          Symbols: {data.limits.allowedSymbols.join(", ")}
        </p>
      </div>

      <div className="panel space-y-3">
        <h3 className="font-semibold">Kill switch &amp; operator controls</h3>
        <Badge tone={data.killSwitch.active ? "blocked" : "safe"}>
          {data.killSwitch.active ? "ACTIVE" : "OFF"}
        </Badge>
        {data.killSwitch.reason ? (
          <p className="text-sm text-[var(--muted)]">{data.killSwitch.reason}</p>
        ) : null}
        <p className="text-sm text-[var(--muted)]">
          Critical operator actions require double confirm on the{" "}
          <Link href="/operator" className="text-[var(--accent)] underline">
            Operator Control Center
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
