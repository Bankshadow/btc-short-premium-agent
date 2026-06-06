import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { getMockDashboardFallback } from "@/lib/mock/dashboard-data";
import { DEFAULT_GOVERNANCE_STATE, GOVERNANCE_STORAGE_KEY } from "@/lib/governance/governance-state";
import { formatSmartBriefingMessage, buildSmartNotification } from "./format-message";
import { shouldNotifyForEvent } from "./should-notify";
import { sanitizeBriefingText } from "./dispatch";
import {
  appendSmartNotification,
  countUnreadNotifications,
  loadSmartNotifications,
  markNotificationResolved,
  persistSmartNotifications,
} from "./notification-store";
import { loadSmartBriefingSettings, saveSmartBriefingSettings } from "./settings-store";
import { DEFAULT_SMART_BRIEFING_SETTINGS } from "./config";
import { emitSmartBriefing } from "./emit";

const store: Record<string, string> = {};

function installStorageMock() {
  (globalThis as { window?: typeof globalThis }).window = globalThis;
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: () => null,
    length: 0,
  } as Storage;
}

describe("smart briefing MVP 45", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    installStorageMock();
    persistSmartNotifications([]);
    saveSmartBriefingSettings({ ...DEFAULT_SMART_BRIEFING_SETTINGS });
    localStorage.setItem(
      GOVERNANCE_STORAGE_KEY,
      JSON.stringify(DEFAULT_GOVERNANCE_STATE),
    );
  });

  it("formats message with verdict, reasons, and label", () => {
    const data = getMockDashboardFallback();
    const message = formatSmartBriefingMessage({
      eventType: "TRADE_CANDIDATE_FOUND",
      status: "SAFE",
      verdict: "TRADE",
      recommendedAction: "Review paper entry",
      topReasons: ["IV elevated", "Regime bearish"],
      deskLabel: "PAPER",
      linkHref: "/portfolio",
    });
    assert.ok(message.includes("TRADE"));
    assert.ok(message.includes("PAPER"));
    assert.ok(message.includes("/portfolio"));
    assert.ok(message.includes("no auto-execution"));
  });

  it("respects onlyCritical setting", () => {
    saveSmartBriefingSettings({ onlyCritical: true });
    const gate = shouldNotifyForEvent("TRADE_CANDIDATE_FOUND", loadSmartBriefingSettings());
    assert.equal(gate.notify, false);
    const critical = shouldNotifyForEvent("RISK_BLOCKER_TRIGGERED", loadSmartBriefingSettings());
    assert.equal(critical.notify, true);
  });

  it("stores in-app notification on emit", async () => {
    const result = await emitSmartBriefing(
      {
        eventType: "PAPER_TRADE_OPENED",
        verdict: "TRADE",
        recommendedAction: "Monitor position",
        topReasons: ["Autopilot entry"],
        deskLabel: "PAPER",
      },
      { skipExternal: true },
    );
    assert.equal(result.dispatched, true);
    assert.equal(loadSmartNotifications().length, 1);
    assert.equal(countUnreadNotifications(), 1);
    assert.equal(result.notification.deskLabel, "PAPER");
  });

  it("sanitizes secret-like tokens from outbound text", () => {
    const safe = sanitizeBriefingText("Token TELEGRAM_BOT_TOKEN=abc123 Bearer secret-key");
    assert.ok(!safe.includes("abc123"));
    assert.ok(safe.includes("[redacted]"));
  });

  it("marks notification resolved", () => {
    const n = buildSmartNotification({
      eventType: "CLOSE_RECOMMENDED",
      actionRequired: true,
      deskLabel: "PAPER",
    });
    appendSmartNotification(n);
    markNotificationResolved(n.id);
    const updated = loadSmartNotifications().find((x) => x.id === n.id);
    assert.equal(updated?.status, "RESOLVED");
    assert.ok(updated?.resolvedAt);
  });
});
