"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "./AdminShell";
import { OpsKpi } from "@/components/ops/OpsShell";
import type { PlatformHealthReport } from "@/lib/observability/types";

export default function AdminIntegrationsDashboard() {
  const [report, setReport] = useState<PlatformHealthReport | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/health");
    const data = (await res.json()) as { ok: boolean; report?: PlatformHealthReport };
    if (data.ok) setReport(data.report ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signals = report?.signals;

  return (
    <AdminShell
      title="Integrations"
      subtitle="Exchange connectivity, alert channels, and webhook delivery."
      activePath="/admin/integrations"
    >
      {signals && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OpsKpi
              label="Exchange"
              value={signals.exchange.connected ? "Connected" : "Down"}
              hint={signals.exchange.network ?? "not configured"}
            />
            <OpsKpi
              label="Telegram"
              value={signals.alerts.telegramConfigured ? "On" : "Off"}
              hint="Alert channel"
            />
            <OpsKpi
              label="Discord"
              value={signals.alerts.discordConfigured ? "On" : "Off"}
              hint="Alert channel"
            />
            <OpsKpi
              label="Delivery failures"
              value={String(signals.alerts.recentDeliveryFailures)}
              hint="Recent"
            />
          </div>

          <section className="desk-panel px-4 py-4 text-xs text-zinc-400">
            <h2 className="text-sm font-semibold text-zinc-100">Exchange</h2>
            <p className="mt-2">
              Configured: {signals.exchange.configured ? "yes" : "no"} · Connected:{" "}
              {signals.exchange.connected ? "yes" : "no"}
            </p>
            {signals.exchange.error && (
              <p className="mt-1 text-rose-300">{signals.exchange.error}</p>
            )}
            <p className="mt-1 text-zinc-600">
              Clock skew: {signals.exchange.clockSkewMs ?? "—"} ms
            </p>
            <Link href="/api/exchange/status" className="mt-2 inline-block text-cyan-400 hover:underline">
              API status →
            </Link>
          </section>

          <section className="desk-panel px-4 py-4 text-xs text-zinc-400">
            <h2 className="text-sm font-semibold text-zinc-100">Alerts & webhooks</h2>
            <p className="mt-2">
              Desk webhook: {signals.alerts.deskWebhookConfigured ? "configured" : "missing"}
            </p>
            <p className="mt-1">
              Last delivery:{" "}
              {signals.alerts.lastDeliveryAt
                ? new Date(signals.alerts.lastDeliveryAt).toLocaleString()
                : "—"}
            </p>
            <Link href="/notifications" className="mt-2 inline-block text-amber-400 hover:underline">
              Notifications →
            </Link>
          </section>
        </>
      )}
    </AdminShell>
  );
}
