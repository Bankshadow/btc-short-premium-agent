"use client";

import { Badge } from "@/components/use-api";
import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-mono text-sm break-all">{value}</p>
    </div>
  );
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

export function BinanceTestnetDiagnosticsPanel({
  data,
  title = "Binance testnet diagnostics",
}: {
  data: BinanceStatusDiagnostics;
  title?: string;
}) {
  const connected = data.status === "CONNECTED";
  const tone = connected ? "safe" : data.status === "MISSING_ENV" ? "wait" : "blocked";

  return (
    <div className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Badge tone={tone}>{data.status}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="testnetEnabled" value={yesNo(data.testnetEnabled)} />
        <Field label="liveEnabled" value={yesNo(data.liveEnabled)} />
        <Field label="apiKeyPresent" value={yesNo(data.apiKeyPresent)} />
        <Field label="apiSecretPresent" value={yesNo(data.apiSecretPresent)} />
        <Field label="proxyEnabled" value={yesNo(data.proxyEnabled)} />
        <Field label="proxyUrlConfigured" value={yesNo(data.proxyUrlConfigured)} />
        <Field label="baseUrl" value={data.baseUrl || "https://demo-fapi.binance.com"} />
        <Field
          label="lastCheckedAt"
          value={new Date(data.lastCheckedAt).toLocaleString()}
        />
        <Field label="manualExecuteOnly" value={yesNo(data.manualExecuteOnly)} />
      </div>

      <div className="rounded border border-[var(--border)] p-3 space-y-2">
        <p className="text-sm">
          <span className="font-medium">Reason:</span> {data.reason}
        </p>
        <p className="text-sm text-[var(--muted)]">
          <span className="font-medium">Recommendation:</span> {data.recommendation}
        </p>
      </div>

      {data.status === "BLOCKED_BY_REGION" ? (
        <p className="text-sm text-[var(--danger)]">
          Region/IP block — set BINANCE_PROXY_ENABLED=true and BINANCE_PROXY_URL on the server.
        </p>
      ) : null}

      <p className="text-xs text-[var(--muted)]">
        Live locked · Auto-execute off · API credentials never sent to browser.
      </p>
    </div>
  );
}
