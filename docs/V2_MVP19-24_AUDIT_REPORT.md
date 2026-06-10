# V2 MVP 19–24 Audit Report

**Branch:** `v2-core`  
**Checked:** 2026-06-06  
**Updated:** 2026-06-06 (post P0/P1 fixes)  
**Scope:** MVP 19 (Operator Control Center), MVP 20 (Briefing + Session Replay), MVP 21 (Portfolio Risk Manager), MVP 22 (Micro-Live Readiness), MVP 23 (Live Sandbox), MVP 24 (Audit Pack + Production Hardening)

---

## Executive summary

| Item | Result |
|------|--------|
| **Overall MVP 19–24 status** | **COMPLETE** for P0/P1 scope |
| **Recommendation** | **NOT_READY_FOR_MICRO_LIVE** (by design — readiness gaps expected until evidence collected) |
| **Tests** | 136/136 pass (`npm test`) |
| **Build** | Pass (`npm run build`) |
| **Live trading** | Locked |
| **Real live orders** | Not possible via sandbox dry-run |

P0 safety issues (kill-switch hydration and env override) and P1 exit-criteria gaps are resolved. P2/P3 items remain deferred.

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Safety/correctness — kill switch bypass, live-trading risk |
| **P1** | Missing exit criteria, broken semantics, critical test/UI gaps |
| **P2** | UI polish, minor inconsistencies |
| **P3** | Nice-to-have, docs drift |

---

## P0 — Safety / correctness

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| P0-1 | Kill switch journal state not loaded on cold start | **FIXED** | `hydrateOperatorGateState()` called before all preview/execution/close gates and binance status |
| P0-2 | `KILL_SWITCH_ACTIVE=false` env overrides journal-enabled kill switch | **FIXED** | Env override is force-ON only; journal is source of truth otherwise |

**Commits:** `033adc3` — `fix(P0): hydrate kill switch from journal before all gates`

---

## P1 — Exit criteria / API / test gaps

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| P1-1 | Portfolio “daily loss” uses cumulative PnL | **FIXED** | `sumDailyPnl()` filters `PNL_REALIZED` by UTC calendar day |
| P1-2 | Cooldown state in-memory only | **FIXED** | `loadCooldownUntil()` hydrates from `COOLDOWN_STARTED` events |
| P1-3 | Engine pause does not block close paths | **FIXED** | `isOperatorBlocked()` in close preview and close safety gate |
| P1-4 | `mvp19-24-loops.test.ts` missing critical coverage | **FIXED** | Added stale-cache, double-confirm, engine pause, portfolio block, cooldown, security tests |
| P1-5 | No UI to create briefing or session replay | **FIXED** | Reports page: Generate briefing, Create replay, session list |
| P1-6 | Portfolio risk events only on explicit evaluate | **FIXED** | Reports page: “Evaluate portfolio risk” button (POST evaluate) |
| P1-7 | `enableKillSwitch` rejects when live env flag set | **FIXED** | Removed `isLiveEnabled()` gate on enable — kill switch always available |

**Commits:** `4d037c2`, `90127ce`

---

## P2 — UI polish / inconsistencies (deferred)

| # | Issue | Status |
|---|-------|--------|
| P2-1 | Dashboard missing kill-switch badge | **OPEN** |
| P2-2 | Operator page has no operator events feed | **OPEN** |
| P2-3 | Live sandbox preflight/dry-run and readiness evaluate not wired in UI | **OPEN** |
| P2-4 | Settings kill-switch display may be stale | **FIXED** (via P0-1 hydration on binance status) |
| P2-5 | `riskMode` is display-only (no gate effect) | **OPEN** — document or wire |
| P2-6 | Inconsistent sprint labels across pages | **OPEN** |

---

## P3 — Nice-to-have (deferred)

| # | Issue | Status |
|---|-------|--------|
| P3-1 | Legacy `/api/risk/kill-switch` stub still present | **OPEN** |
| P3-2 | `runSecurityCheck` flags configured API secret as issue | **OPEN** — may be intentional |
| P3-3 | Docs use old MVP 19–24 numbering vs implementation | **OPEN** |

---

## Integration matrix (post-fix)

| Path | Kill switch | Engine pause | Portfolio risk |
|------|-------------|--------------|----------------|
| Analysis verdict | ✅ hydrated | ✅ hydrated | N/A |
| Open preview | ✅ hydrated | ✅ hydrated | N/A |
| Open execute | ✅ hydrated | ✅ hydrated | ✅ |
| Close preview | ✅ hydrated | ✅ hydrated | N/A |
| Close execute | ✅ hydrated | ✅ hydrated | N/A |

---

## Exit criteria checklist

| MVP | Criterion | Status |
|-----|-----------|--------|
| 19 | Operator can pause/block system | **PASS** |
| 19 | All actions auditable | **PASS** |
| 20 | Daily briefing visible | **PASS** |
| 20 | Session replay reconstructs lifecycle | **PASS** |
| 21 | Portfolio risk controls trade eligibility | **PASS** |
| 22 | Readiness report explains gaps | **PASS** |
| 22 | Live remains disabled | **PASS** |
| 23 | Live dry-run exists | **PASS** |
| 23 | No live order possible | **PASS** |
| 24 | Audit pack export exists | **PASS** |
| 24 | Production hardening report exists | **PASS** |

---

## Next steps (P2/P3 only)

1. Dashboard kill-switch badge
2. Operator events timeline on `/operator`
3. Settings/Reports buttons for sandbox preflight, dry-run, readiness evaluate
4. Remove or redirect legacy `/api/risk/kill-switch`
5. Align docs with implemented MVP 19–24 scope
