# UI v0 Dashboard Migration Report

Branch: **`ui-v0-dashboard-migration`** (from `v2-core`)  
Date: **2026-06-06**  
Design source: `ux-ui-project.zip` → `.v0-design/` (local reference only, not shipped)

---

## Summary

The v2 operator UI was migrated to a v0-inspired dashboard layout while preserving Core Engine, projection APIs, Event Journal semantics, and all trading/safety constraints. The UI remains presentation-only: no PnL, evidence, readiness, or trade counts are computed client-side.

---

## Pages updated

| Route | Status | Notes |
|-------|--------|-------|
| `/` | **Redesigned** | Mission overview, core safety, lifecycle timeline, trade/position, evidence & learning, AI intelligence panels |
| `/core` | **Updated** | v0 styling; remains technical diagnostics (health, consistency, parity, warnings, live lock) |
| `/trades` | **Updated** | Trade projection API; PnL/evidence status badges; lifecycle per trade |
| `/ai-status` | **Updated** | Event feed, lifecycle trace, MiroFish advisory, agent context, no-trade rules |
| `/reports` | **Updated** | Mission/PnL/evidence from projections; legacy briefing/audit sections retained with `StatCard` |
| `/settings` | **Updated** | Safe config status (key present/missing); no blocking health loading gate |
| `/operator` | **Unchanged** | Still uses legacy `LoadingOrError` + `StatCard` (out of migration scope) |

---

## Components added

`src/components/ui/`:

| File | Purpose |
|------|---------|
| `status-badge.tsx` | OK / WARNING / BLOCKED semantic badges |
| `metric-card.tsx` | v0-style stat cards (projection-fed props) |
| `progress-card.tsx` | Evidence/mission progress bars |
| `safety-panel.tsx` | Core safety status grid |
| `lifecycle-timeline.tsx` | Lifecycle phase visualization |
| `projection-warning.tsx` | Projection unavailable / partial warnings |
| `zero-state-card.tsx` | Safe empty states |
| `risk-banner.tsx` | Aggregated risk/blocker banners |
| `event-feed.tsx` | Journal event list presentation |
| `safety-labels.tsx` | TESTNET ONLY, LIVE LOCKED, etc. |
| `page-header.tsx` | Consistent page titles |
| `section-card.tsx` | Panel wrapper |
| `index.ts` | Barrel exports |

Supporting:

- `src/lib/ui/lifecycle-display.ts` — presentation-only lifecycle phase mapping from API context
- `src/components/projection-warning.tsx` — re-exports from `ui/`
- `src/components/AppShell.tsx` — wider layout, v0 header styling
- `src/app/globals.css` — ring-pop, metric cards, safety label styles

---

## Projection APIs used

| API | Pages |
|-----|-------|
| `GET /api/core/projections/bundle` | `/`, `/core`, `/trades`, `/ai-status`, `/reports`, `/settings` |
| `GET /api/core/health` | `/core` |
| `GET /api/core/ui-consistency` | `/core` |
| `GET /api/core/projection-parity` | `/core` |
| `GET /api/binance/status` | `/`, `/settings`, `/ai-status` |
| `GET /api/core/ui/context` | `/` (lifecycle, preview, position context) |
| `GET /api/core/projections/trades` | `/trades` |
| `GET /api/core/trace/[id]` | `/ai-status` (when trace available) |
| `GET /api/reports/summary` | `/reports` (legacy sections) |

---

## Old UI removed or retained

### Removed / replaced on primary surfaces
- Ad-hoc `panel` grids on dashboard → `MetricCard`, `SafetyPanel`, `SectionCard`
- Full-page `LoadingOrError` gates on `/settings` (replaced with zero-state fallbacks)
- Inline safety text blocks → `SafetyLabelsBar` + `SafetyPanel`

### Retained
- `ExecutionReviewModal`, `CloseReviewModal` on dashboard
- `BinanceTestnetDiagnosticsPanel` on settings/ai-status
- `StatCard` on `/reports` legacy briefing/audit sections and `/operator`
- `useProjectionBundle`, `useApi`, `fetchJson` data hooks
- Start AI flow and human-confirm modals

---

## Safety constraints verified

| Constraint | Status |
|------------|--------|
| No trading logic changes | ✅ |
| No Binance execution changes | ✅ |
| No risk / execution / close gate changes | ✅ |
| Live trading not enabled | ✅ (`liveLocked: true` in projections) |
| No auto-execute / force execute / force close | ✅ |
| UI does not compute critical state | ✅ (grep tests) |
| No mock data as source of truth | ✅ (`.v0-design/mock.json` not imported) |
| No secrets exposed | ✅ (present/missing only in settings) |

Safety labels displayed: **TESTNET ONLY**, **LIVE LOCKED**, **HUMAN CONFIRM REQUIRED**, **MCP / MiroFish ADVISORY ONLY**, **NO AUTO-EXECUTE**, **REDUCE-ONLY CLOSE REQUIRED**.

---

## Zero-state and loading behavior

All updated pages use projection fallbacks via `useProjectionBundle` / `useApi` with `fallback` options. Pages render immediately with safe defaults:

- `currentEquity = 1000`, `targetEquity = 10000`, `progressPct = 0`
- `trades = 0`, `open = 0`, `closed = 0`, `netPnl = 0`
- `evidence = 0/12`, `liveLocked = true`
- Binance = `MISSING_ENV` or actual API status

`ProjectionWarning` banner shown when bundle fetch fails or returns partial data.

---

## Tests

File: `src/lib/core/ui-v0-migration.test.ts` (11 tests)

Also updated: `projection-ui.test.ts`, `production-loading-fix.test.ts`

| Test | Result |
|------|--------|
| Design system components exist | ✅ |
| Dashboard renders projection zero-state | ✅ |
| Dashboard does not calculate PnL | ✅ |
| Reports does not calculate evidence | ✅ |
| Trades uses projection API | ✅ |
| Settings does not expose secrets | ✅ |
| Core page shows health status | ✅ |
| No permanent LoadingOrError gate | ✅ |
| Dashboard does not import v0 mock | ✅ |
| Live trading remains locked | ✅ |
| Safety labels defined | ✅ |

**Full suite: 265/265 pass**

---

## Build result

```
npm run build  →  ✅ success (Next.js 16.2.7)
npm test       →  ✅ 265/265 pass
```

---

## Manual verification notes

Recommended checks after `npm run dev`:

1. **`/`** — Six dashboard panels render within ~5s with zero-state if journal empty; safety labels visible; Start AI still works.
2. **`/core`** — Health, UI consistency, projection parity, warning aggregation; no endless loading.
3. **`/trades`** — Empty list with zero-state; PnL badges (`PNL_REALIZED`, `PENDING_PNL`, `CLOSED_PENDING_PNL`); evidence badges (`VALID`, `REJECTED`, `PENDING`).
4. **`/ai-status`** — Event feed, latest run/decisionLogId, MiroFish advisory section.
5. **`/reports`** — Mission/PnL/evidence from bundle only; no client-side recalculation.
6. **`/settings`** — API key/secret shown as present/missing only; live lock and kill switch status.

Screenshots: not captured in CI — verify locally in browser.

---

## Known limitations

1. **`/operator`** not migrated — still uses legacy `LoadingOrError` and `StatCard`.
2. **`/reports`** lower sections (briefing, audit, improvements) retain legacy `StatCard` layout.
3. **v0 chat/notifications** from design zip intentionally excluded (not relevant to trading agent).
4. **`.v0-design/`** kept locally for reference; should not be committed.
5. Production URL verification (`/core`, `/api/core/ui-consistency`, etc.) not run in this migration pass.

---

## Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Partial bundle fetch shows stale panel data | Low | `ProjectionWarning` + per-hook fallbacks |
| Operator page inconsistent UX | Low | Future pass can align with design system |
| Reports legacy sections mix old/new components | Low | Functional; projection sections use new components |
| v0 design drift if zip updated | Low | `.v0-design/` is reference-only |

---

## Files changed (migration)

- `src/app/page.tsx`, `core/page.tsx`, `trades/page.tsx`, `ai-status/page.tsx`, `reports/page.tsx`, `settings/page.tsx`
- `src/app/globals.css`
- `src/components/AppShell.tsx`, `projection-warning.tsx`, `ui/*`
- `src/lib/ui/lifecycle-display.ts`
- `src/lib/core/ui-v0-migration.test.ts`, `projection-ui.test.ts`, `production-loading-fix.test.ts`
- `package.json` (test script includes new test file)
- `docs/UI_V0_MIGRATION_PLAN.md`, `docs/UI_V0_MIGRATION_REPORT.md`
