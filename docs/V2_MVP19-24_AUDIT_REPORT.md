# V2 MVP 19–24 Audit Report

**Branch:** `v2-core`  
**Checked:** 2026-06-06  
**Scope:** MVP 19 (Operator Control Center), MVP 20 (Briefing + Session Replay), MVP 21 (Portfolio Risk Manager), MVP 22 (Micro-Live Readiness), MVP 23 (Live Sandbox), MVP 24 (Audit Pack + Production Hardening)

---

## Executive summary

| Item | Result |
|------|--------|
| **Overall MVP 19–24 status** | **MOSTLY COMPLETE** — core libs, APIs, and tests exist |
| **Recommendation** | **NOT_READY_FOR_MICRO_LIVE** until P0/P1 fixes land |
| **Tests** | 130/130 pass (`npm test`) |
| **Build** | Pass (`npm run build`) |
| **Live trading** | Locked (`isLiveEnabled()` false in execution paths) |
| **Real live orders** | Not possible via sandbox dry-run |

Core backend loops are implemented. The main risks are **kill-switch state not reliably hydrated from the journal on cold start**, **env override bypassing journal ON state**, and **portfolio/operator governance gaps on close paths and daily-loss semantics**.

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

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| P0-1 | Kill switch journal state not loaded on cold start | **OPEN** | `getKillSwitchState()` returns `journalCache ?? { active: false }` without journal read unless `refreshKillSwitchFromJournal()` ran earlier. Preview/close gates call sync `getKillSwitchState()` directly. |
| P0-2 | `KILL_SWITCH_ACTIVE=false` env overrides journal-enabled kill switch | **OPEN** | `envKillSwitchOverride()` returns `{ active: false }` before journal cache is consulted. |

**Files:** `src/lib/operator/kill-switch.ts`, `src/lib/execution/create-preview.ts`, `src/lib/execution/create-close-preview.ts`, `src/lib/execution/execution-safety-gate.ts`, `src/lib/execution/close-safety-gate.ts`, `src/app/api/binance/status/route.ts`

**Recommended fix:** Refresh journal before every gate read; treat env `true` as force-ON only (ignore env `false`).

---

## P1 — Exit criteria / API / test gaps

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| P1-1 | Portfolio “daily loss” uses cumulative PnL, not calendar-day PnL | **OPEN** | `dailyPnl = mission.netPnl` in `portfolio-risk-manager.ts` |
| P1-2 | Cooldown state is in-memory only (lost on restart) | **OPEN** | `let cooldownUntil` module var; not hydrated from `COOLDOWN_STARTED` events |
| P1-3 | Engine pause does not block close paths | **OPEN** | `isOperatorBlocked()` not used in close preview/safety/execute modules |
| P1-4 | `mvp19-24-loops.test.ts` missing critical path coverage | **OPEN** | Kill-switch cold-start, double-confirm rejection, close-path block, portfolio blocks execute |
| P1-5 | No UI to create briefing or session replay | **OPEN** | Reports shows `latestBriefing` read-only; no replay panel |
| P1-6 | Portfolio risk journal events only on explicit evaluate | **OPEN** | Reports/dashboard use `buildPortfolioRiskView()`; history empty until POST evaluate |
| P1-7 | `enableKillSwitch` rejects when `isLiveEnabled()` is true | **OPEN** | Operator cannot enable kill switch when live env flag set — opposite of safety intent |

**Files:** `src/lib/portfolio-risk/portfolio-risk-manager.ts`, `src/lib/execution/create-close-preview.ts`, `src/lib/execution/close-safety-gate.ts`, `src/lib/mvp19-24-loops.test.ts`, `src/app/reports/page.tsx`, `src/lib/operator/operator-actions.ts`

---

## P2 — UI polish / inconsistencies

| # | Issue | Status |
|---|-------|--------|
| P2-1 | Dashboard missing kill-switch badge | **OPEN** |
| P2-2 | Operator page has no operator events feed | **OPEN** |
| P2-3 | Live sandbox preflight/dry-run and readiness evaluate not wired in UI | **OPEN** |
| P2-4 | Settings kill-switch display may be stale (same root as P0-1) | **OPEN** |
| P2-5 | `riskMode` is display-only (no gate effect) | **OPEN** — document or wire |
| P2-6 | Inconsistent sprint labels across pages | **OPEN** |

---

## P3 — Nice-to-have

| # | Issue | Status |
|---|-------|--------|
| P3-1 | Legacy `/api/risk/kill-switch` stub still present | **OPEN** |
| P3-2 | `runSecurityCheck` flags configured API secret as issue | **OPEN** — may be intentional |
| P3-3 | Docs use old MVP 19–24 numbering vs implementation | **OPEN** |

---

## Integration matrix (pre-fix)

| Path | Kill switch | Engine pause | Portfolio risk |
|------|-------------|--------------|----------------|
| Analysis verdict | ✅ (after `getOperatorStatus`) | ✅ sync cache | N/A |
| Open preview | ✅ sync cache | ✅ sync cache | N/A |
| Open execute | ✅ refreshed | ✅ via operator status | ✅ |
| Close preview | ✅ sync cache | ❌ | ❌ |
| Close execute | ✅ sync cache | ❌ | ❌ |

---

## What is working (no issue filed)

- Operator APIs with double-confirm for critical actions
- Journal events: `OPERATOR_ACTION_RECORDED`, `KILL_SWITCH_*`, `RISK_MODE_CHANGED`, `MANUAL_NOTE_CREATED`, `ENGINE_PAUSED/RESUMED`
- Briefing and replay are read-only; replay never places orders
- Micro-live readiness GET is read-only; POST evaluate writes events
- Live sandbox dry-run always `simulatedOrder: null`, `liveLocked: true`
- Audit pack redacts secrets; production/security checks write events
- `/operator`, `/reports`, `/settings` wired; dashboard portfolio risk badge
- 130 tests pass including `mvp19-24-loops.test.ts` baseline coverage

---

## Fix order (this sprint)

1. **P0** — Kill-switch hydration + env override semantics
2. **P1** — Daily PnL, cooldown hydration, close-path operator block, tests, briefing/replay UI, evaluate button, enable kill switch when live flag set
3. **Update this report** — mark P0/P1 resolved before P2 work
4. **P2/P3** — deferred

---

## Exit criteria checklist

| MVP | Criterion | Pre-audit |
|-----|-----------|-----------|
| 19 | Operator can pause/block system | Partial — close path gaps |
| 19 | All actions auditable | ✅ |
| 20 | Daily briefing visible | Partial — no create UI |
| 20 | Session replay reconstructs lifecycle | ✅ API; no UI |
| 21 | Portfolio risk controls trade eligibility | Partial — daily loss semantics |
| 22 | Readiness report explains gaps | ✅ |
| 22 | Live remains disabled | ✅ |
| 23 | Live dry-run exists | ✅ |
| 23 | No live order possible | ✅ |
| 24 | Audit pack export exists | ✅ |
| 24 | Production hardening report exists | ✅ |
