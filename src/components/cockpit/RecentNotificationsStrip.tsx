"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSmartNotifications } from "@/lib/smart-briefing/notification-store";
import type { SmartNotification } from "@/lib/smart-briefing/types";
import DeskEmptyState from "@/components/desk/DeskEmptyState";
import { NOTIFICATIONS_EMPTY } from "@/lib/ux/empty-states";
import StatusBadge from "@/components/ux/StatusBadge";
import { mapDeskStatusToBadge } from "@/lib/ux/status-badges";

export default function RecentNotificationsStrip({ limit = 4 }: { limit?: number }) {
  const [items, setItems] = useState<SmartNotification[]>([]);

  useEffect(() => {
    const refresh = () => {
      setItems(
        loadSmartNotifications()
          .filter((n) => n.status !== "RESOLVED")
          .slice(0, limit),
      );
    };
    refresh();
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [limit]);

  if (items.length === 0) {
    return (
      <DeskEmptyState
        title={NOTIFICATIONS_EMPTY.title}
        missing={NOTIFICATIONS_EMPTY.missing}
        why={NOTIFICATIONS_EMPTY.why}
        actionLabel={NOTIFICATIONS_EMPTY.actionLabel}
        actionHref={NOTIFICATIONS_EMPTY.actionHref}
      />
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">Recent alerts</h2>
        <Link href="/notifications" className="text-xs text-amber-400 hover:underline">
          All alerts →
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className="flex flex-wrap items-start gap-2 rounded border border-zinc-800/80 px-3 py-2 text-xs"
          >
            <StatusBadge
              status={
                n.severity === "CRITICAL"
                  ? "BLOCKED"
                  : n.actionRequired
                    ? "NEEDS_ACTION"
                    : mapDeskStatusToBadge(n.severity === "WARNING" ? "CAUTION" : "SAFE")
              }
            />
            {n.deskLabel === "PAPER" && <StatusBadge status="PAPER" />}
            {n.deskLabel === "SHADOW" && <StatusBadge status="SHADOW" />}
            <span className="font-medium text-zinc-200">{n.title}</span>
            <span className="text-zinc-500">
              {n.message.length > 100 ? `${n.message.slice(0, 100)}…` : n.message}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
