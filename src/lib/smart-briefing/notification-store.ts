import { MAX_NOTIFICATIONS, SMART_NOTIFICATIONS_KEY } from "./config";
import type { NotificationStatus, SmartNotification } from "./types";

export function loadSmartNotifications(): SmartNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SMART_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SmartNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSmartNotifications(
  items: SmartNotification[],
): SmartNotification[] {
  const trimmed = items.slice(0, MAX_NOTIFICATIONS);
  if (typeof window !== "undefined") {
    localStorage.setItem(SMART_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
  }
  return trimmed;
}

export function appendSmartNotification(
  notification: SmartNotification,
): SmartNotification[] {
  const next = [notification, ...loadSmartNotifications()].slice(0, MAX_NOTIFICATIONS);
  return persistSmartNotifications(next);
}

export function countUnreadNotifications(): number {
  return loadSmartNotifications().filter((n) => n.status === "UNREAD").length;
}

export function markNotificationRead(id: string): SmartNotification[] {
  const at = new Date().toISOString();
  return persistSmartNotifications(
    loadSmartNotifications().map((n) =>
      n.id === id && n.status === "UNREAD"
        ? { ...n, status: "READ" as NotificationStatus, readAt: at }
        : n,
    ),
  );
}

export function markNotificationResolved(id: string): SmartNotification[] {
  const at = new Date().toISOString();
  return persistSmartNotifications(
    loadSmartNotifications().map((n) =>
      n.id === id
        ? {
            ...n,
            status: "RESOLVED" as NotificationStatus,
            readAt: n.readAt ?? at,
            resolvedAt: at,
          }
        : n,
    ),
  );
}

export function markAllNotificationsRead(): SmartNotification[] {
  const at = new Date().toISOString();
  return persistSmartNotifications(
    loadSmartNotifications().map((n) =>
      n.status === "UNREAD"
        ? { ...n, status: "READ" as NotificationStatus, readAt: at }
        : n,
    ),
  );
}
