import assert from "node:assert/strict";

import { describe, it } from "node:test";

import {

  mapDeskStatusToBadge,

  mapLiveReadinessToBadge,

  mapVerdictToBadge,

  STATUS_BADGE_STYLES,

} from "./status-badges";

import {

  formatVerdictLabel,

  summarizeWhatAiDid,

} from "./operator-copy";

import {

  PRIMARY_NAV,

  TRADING_NAV,

  PLATFORM_NAV,

  ADVANCED_NAV,

} from "@/components/ops/nav-groups";



describe("P-MVP 6 platform UX", () => {

  it("maps desk statuses to operator badges including EMERGENCY", () => {

    assert.equal(mapDeskStatusToBadge("SAFE"), "SAFE");

    assert.equal(mapDeskStatusToBadge("EMERGENCY"), "EMERGENCY");

    assert.equal(mapVerdictToBadge("TRADE"), "NEEDS_ACTION");

    assert.equal(mapLiveReadinessToBadge("PASS"), "SAFE");

    assert.equal(mapLiveReadinessToBadge("FAIL"), "BLOCKED");

  });



  it("defines all required status badge styles", () => {

    for (const key of [

      "SAFE",

      "CAUTION",

      "BLOCKED",

      "EMERGENCY",

      "RUNNING",

      "NEEDS_ACTION",

      "PAPER",

      "SHADOW",

      "TESTNET",

      "LIVE_LOCKED",

    ]) {

      assert.ok(STATUS_BADGE_STYLES[key as keyof typeof STATUS_BADGE_STYLES]);

    }

  });



  it("uses operator-friendly verdict labels", () => {

    assert.ok(formatVerdictLabel("TRADE").includes("paper"));

    assert.ok(formatVerdictLabel("WAIT").includes("Wait"));

  });



  it("summarizes AI modules in plain language", () => {

    const lines = summarizeWhatAiDid([

      {

        moduleId: "portfolio",

        status: "OK",

        summary: "2 open paper trades",

        shouldDisplayToUser: true,

        durationMs: 10,

      },

    ]);

    assert.ok(lines[0].includes("Portfolio"));

  });



  it("exposes P-MVP 6 navigation groups", () => {

    assert.deepEqual(

      PRIMARY_NAV.map((n) => n.label),

      ["Cockpit", "Autopilot", "Portfolio", "Actions", "Notifications"],

    );

    assert.equal(TRADING_NAV.length, 5);

    assert.equal(PLATFORM_NAV.length, 7);
    assert.ok(PLATFORM_NAV.some((n) => n.href === "/admin/health"));

    assert.deepEqual(

      ADVANCED_NAV.map((n) => n.label),

      ["Agents", "Council", "Simulation", "War Room", "API Docs"],

    );

    assert.ok(PLATFORM_NAV.some((n) => n.href === "/data"));

    assert.ok(PLATFORM_NAV.some((n) => n.href === "/audit"));

  });

});

