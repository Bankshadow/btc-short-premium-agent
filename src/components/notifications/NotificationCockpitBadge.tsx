"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  countUnreadNotifications,
  loadSmartNotifications,
} from "@/lib/smart-briefing/notification-store";

export default function NotificationCockpitBadge() {
  const [unread, setUnread] = useState(0);
  const [critical, setCritical] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const items = loadSmartNotifications().filter((n) => n.status !== "RESOLVED");
      setUnread(countUnreadNotifications());
      setCritical(items.filter((n) => n.severity === "CRITICAL").length);
    };
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/notifications"
      className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/30"
    >
      Alerts {unread > 0 ? `(${unread})` : ""}
      {critical > 0 ? ` · ${critical} critical` : ""}
    </Link>
  );
}
