"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OpsShell from "@/components/ops/OpsShell";
import {
  SMART_BRIEFING_SAFETY_NOTICE,
} from "@/lib/smart-briefing/config";
import {
  countUnreadNotifications,
  loadSmartNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationResolved,
} from "@/lib/smart-briefing/notification-store";
import {
  loadSmartBriefingSettings,
  saveSmartBriefingSettings,
} from "@/lib/smart-briefing/settings-store";
import type {
  NotificationSeverity,
  SmartBriefingSettings,
  SmartNotification,
} from "@/lib/smart-briefing/types";

const SEVERITY_STYLE: Record<NotificationSeverity, string> = {
  INFO: "text-cyan-300 border-cyan-900/40",
  WARNING: "text-amber-300 border-amber-900/40",
  CRITICAL: "text-rose-300 border-rose-900/40",
};

export default function NotificationsDashboard() {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [settings, setSettings] = useState<SmartBriefingSettings>(
    loadSmartBriefingSettings(),
  );
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | "ALL">(
    "ALL",
  );
  const [actionOnly, setActionOnly] = useState(false);

  const refresh = useCallback(() => {
    setNotifications(loadSmartNotifications());
    setSettings(loadSmartBriefingSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (severityFilter !== "ALL" && n.severity !== severityFilter) return false;
      if (actionOnly && !n.actionRequired) return false;
      return n.status !== "RESOLVED";
    });
  }, [notifications, severityFilter, actionOnly]);

  const unread = countUnreadNotifications();

  const patchSettings = (p: Partial<SmartBriefingSettings>) => {
    const next = saveSmartBriefingSettings(p);
    setSettings(next);
  };

  return (
    <OpsShell
      badge="MVP 45 · Smart Briefing"
      title="Notification Center"
      subtitle="Operator-focused alerts — paper/shadow lifecycle, blockers, and desk cycles."
      accent="amber"
      iconLetters="NT"
      activePath="/notifications"
      nav={[
        { href: "/", label: "← Cockpit" },
        { href: "/actions", label: "Actions" },
        { href: "/autopilot", label: "Autopilot" },
      ]}
    >
      <p className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-2 text-xs text-amber-200/90">
        {SMART_BRIEFING_SAFETY_NOTICE}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-300">
          {unread} unread
        </span>
        <button
          type="button"
          onClick={() => {
            markAllNotificationsRead();
            refresh();
          }}
          className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-zinc-200"
        >
          Mark all read
        </button>
        <select
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
          value={severityFilter}
          onChange={(e) =>
            setSeverityFilter(e.target.value as NotificationSeverity | "ALL")
          }
        >
          <option value="ALL">All severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <label className="flex items-center gap-1 text-zinc-400">
          <input
            type="checkbox"
            checked={actionOnly}
            onChange={(e) => setActionOnly(e.target.checked)}
          />
          Action required only
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Inbox
          </h2>
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500">No notifications match filters.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg border bg-zinc-900/40 px-3 py-2 ${SEVERITY_STYLE[n.severity]}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{n.title}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                      {n.deskLabel}
                    </span>
                    {n.actionRequired && (
                      <span className="text-amber-400">Action required</span>
                    )}
                    {n.status === "UNREAD" && (
                      <span className="text-cyan-400">Unread</span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-400">
                    {n.message.slice(0, 280)}
                    {n.message.length > 280 ? "…" : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {new Date(n.createdAt).toLocaleString()} · {n.eventType}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={n.linkHref}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      Open page →
                    </Link>
                    {n.status === "UNREAD" && (
                      <button
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          refresh();
                        }}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        markNotificationResolved(n.id);
                        refresh();
                      }}
                      className="text-[11px] text-emerald-500 hover:text-emerald-300"
                    >
                      Resolve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Alert settings
          </h2>
          <div className="space-y-2 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.onlyCritical}
                onChange={(e) => patchSettings({ onlyCritical: e.target.checked })}
              />
              Only critical alerts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.tradeCandidates}
                onChange={(e) => patchSettings({ tradeCandidates: e.target.checked })}
              />
              Trade candidates
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.paperLifecycle}
                onChange={(e) => patchSettings({ paperLifecycle: e.target.checked })}
              />
              Paper lifecycle
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.dailySummary}
                onChange={(e) => patchSettings({ dailySummary: e.target.checked })}
              />
              Daily summary
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.weeklyReport}
                onChange={(e) => patchSettings({ weeklyReport: e.target.checked })}
              />
              Weekly learning report
            </label>
            <label className="flex items-center gap-2 text-zinc-400">
              <input
                type="checkbox"
                checked={settings.quietHours}
                onChange={(e) => patchSettings({ quietHours: e.target.checked })}
              />
              Quiet hours (Bangkok 22:00–08:00)
            </label>
          </div>
          <p className="mt-4 text-[11px] text-zinc-500">
            External channels: Telegram, Discord, and desk webhook use server env vars.
            Configure Discord URL in desk settings on the cockpit operator panel.
          </p>
        </section>
      </div>
    </OpsShell>
  );
}
