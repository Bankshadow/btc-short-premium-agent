# UI v0 Dashboard Migration Plan

Branch: **`ui-v0-dashboard-migration`**  
Design source: `ux-ui-project.zip` (v0 export — dashboard layout, stat cards, security status panels)  
Date: **2026-06-06**

---

## 1. Current page structure

| Route | Role today | Data sources |
|-------|------------|--------------|
| `/` | Operator dashboard — mission, safety, position, preview modals | `useProjectionBundle`, `/api/core/ui/context` |
| `/core` | Technical diagnostics — health, consistency, parity | Bundle + `/api/core/health`, consistency, parity APIs |
| `/trades` | Open/closed trade list | `/api/core/projections/trades` |
| `/ai-status` | Run trace, journal events, Binance diagnostics | Bundle + analysis, journal, trace APIs |
| `/reports` | Mission/PnL/evidence (projection) + legacy briefing/audit | Bundle + `/api/reports/summary` |
| `/settings` | Binance config, kill switch, hardening checks | Bundle + `/api/binance/status` |
| `/operator` | Kill switch, risk mode (unchanged scope) | Operator APIs |

---

## 2. Target v0-inspired structure

### Dashboard `/`
1. **Page header** — v0 sticky header with title + last updated
2. **Safety labels bar** — TESTNET ONLY, LIVE LOCKED, etc.
3. **Mission metrics grid** — 3-column stat cards (v0 `DashboardStat` style)
4. **Core Safety Status** — v0 `SecurityStatus` panel (projection-fed)
5. **Lifecycle timeline** — phases from API context (presentation only)
6. **Trade/Position + Evidence** — two-column panels
7. **AI Intelligence + Preview** — advisory-only swarm/verdict

### `/core`
Remains technical — consistency, parity, aggregated warnings, API links. No user-facing clutter moved here from dashboard.

---

## 3. Components

### Reuse
- `useProjectionBundle`, `useApi`, `fetchJson`
- `ExecutionReviewModal`, `CloseReviewModal`
- `BinanceTestnetDiagnosticsPanel`
- `projection-defaults`, `ui-context-zero`

### Replace / add (`src/components/ui/`)
| Component | Replaces |
|-----------|----------|
| `status-badge.tsx` | Raw `Badge` for status semantics |
| `metric-card.tsx` | `StatCard` on primary surfaces |
| `progress-card.tsx` | Inline evidence progress blocks |
| `safety-panel.tsx` | Ad-hoc safety stat grids |
| `lifecycle-timeline.tsx` | Flat lifecycle text |
| `projection-warning.tsx` | `projection-warning.tsx` (re-export) |
| `zero-state-card.tsx` | Empty `panel` blocks |
| `risk-banner.tsx` | `error-box` / inline warnings |
| `event-feed.tsx` | Manual event lists |
| `safety-labels.tsx` | — (new) |
| `page-header.tsx` | Per-page h2 headers |
| `section-card.tsx` | Generic `panel` sections |

---

## 4. Projection fields required

| Panel | Fields |
|-------|--------|
| Mission | `mission.currentEquity`, `targetEquity`, `progressPct`, `totalTrades`, `win/loss`, `latestRunId` |
| PnL | `pnl.totalNetPnl` |
| Trades | `trades.open`, `trades.closed`, `positions.openTradeCount` |
| Evidence | `evidence.valid`, `required`, `message`, `readinessStatus` |
| Safety | `health.status`, `risk.liveLocked`, `risk.mode/status`, `binanceStatus` |
| Lifecycle | `ui/context` preview, open trade, closed trade, execution review |
| Intelligence | `mission.latestVerdict`, `swarmReport`, `noTradeBlockReason` |

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| UI computes PnL/evidence | Forbidden imports in pages; tests grep for calculators |
| v0 uses `mock.json` | Never imported — projections only |
| Loading stuck | Zero-state fallbacks + `loading: false` in hooks |
| Secrets in settings | Show present/missing only |
| Breaking modals | Keep execute/close modal wiring on dashboard |

---

## 6. Migration steps

1. ✅ Extract v0 zip to `.v0-design/` (reference only, not shipped)
2. ✅ Add `src/components/ui/*` design system
3. ✅ Extend `globals.css` with v0 ring/card styles
4. ✅ Redesign `/` dashboard layout
5. ✅ Update `/trades`, `/ai-status`, `/reports`, `/settings`, `/core`
6. ✅ Add `src/lib/ui/lifecycle-display.ts` (presentation mapping)
7. ✅ Tests: `ui-v0-migration.test.ts`
8. ✅ Report: `UI_V0_MIGRATION_REPORT.md`

---

## 7. Out of scope

- Trading logic, gates, Binance execution
- Live trading enablement
- New MVP features
- Copying v0 chat/notifications widgets (not relevant to trading agent)
