# Core Engine Slice 7 — UI Migration to Projections

Branch: **`v2-core`**  
Date: **2026-06-06**  
Status: **Complete (adapter migration)**

---

## Goal

Migrate core UI pages to read server-side Core Projections instead of computing critical state locally or reading inconsistent legacy stores. No new MVP features, no execution changes, no live trading.

---

## Migrated Pages

| Route | Status | Primary data source |
|-------|--------|---------------------|
| `/` | ✅ | `useProjectionBundle()` + `/api/core/ui/context` |
| `/trades` | ✅ | `/api/core/projections/trades` |
| `/ai-status` | ✅ | Bundle + journal/analysis/review APIs |
| `/reports` | ✅ | Bundle (primary stats) + legacy summary (briefing/audit) |
| `/settings` | ✅ | Bundle + `/api/binance/status` |
| `/operator` | ✅ | Bundle + `/api/operator/status` |

Audit / replay / briefing live under `/reports` (no separate routes).

---

## Projection APIs Used

| API | Purpose |
|-----|---------|
| `GET /api/core/projections/mission` | Equity, progress, win/loss, latest run IDs |
| `GET /api/core/projections/trades` | Enriched open/closed trades + summary |
| `GET /api/core/projections/positions` | Open position count + snapshots |
| `GET /api/core/projections/pnl` | Net / realized PnL |
| `GET /api/core/projections/evidence` | Evidence valid/required progress |
| `GET /api/core/projections/risk` | Risk mode, blockers, `liveLocked` |
| `GET /api/core/projections/bundle` | Combined payload for UI hook |
| `GET /api/core/health` | Aggregated core health |
| `GET /api/core/trace/[id]` | Available; not yet wired in AI Status UI |
| `GET /api/binance/status` | Exchange connectivity (non-projection) |
| `GET /api/core/ui-consistency` | Cross-page parity verification |
| `GET /api/core/ui/context` | Supplemental dashboard context (non-critical) |

---

## New / Updated Files

### Client & server helpers

- `src/lib/core/projection-client.ts` — `getMissionProjection()`, `getTradeProjection()`, `getPositionProjection()`, `getPnlProjection()`, `getEvidenceProjection()`, `getRiskProjection()`, `getCoreHealth()`, `getProjectionBundle()`
- `src/lib/core/projection-bundle.ts` — `buildProjectionBundle()`, `zeroProjectionBundle()`
- `src/lib/core/build-enriched-trade-projection.ts` — Legacy-shaped trade list from events
- `src/lib/core/ui-context.ts` — Dashboard modals, preview, swarm (non-critical)
- `src/lib/core/ui-consistency-check.ts` — `runUiConsistencyCheck()`
- `src/components/use-projection-bundle.tsx` — React hook with safe zero-state on error

### API routes

- `src/app/api/core/projections/pnl/route.ts`
- `src/app/api/core/projections/risk/route.ts`
- `src/app/api/core/projections/bundle/route.ts`
- `src/app/api/core/ui-consistency/route.ts`
- `src/app/api/core/ui/context/route.ts`
- Updated: `src/app/api/core/projections/trades/route.ts` (enriched shape)

### Tests

- `src/lib/core/projection-ui.test.ts` — Zero-state, consistency, static UI guards

---

## Removed Duplicate State Logic

- Dashboard no longer uses `/api/mission/snapshot` for equity, PnL, evidence, or trade counts.
- Trades page no longer uses `/api/trades` (legacy store).
- Reports primary stat cards use projection bundle, not local summary derivation.
- Settings / Operator show `risk.liveLocked` and core health from projections.
- Binance `baseUrl` default shown when env uses demo-fapi default (dashboard context).

---

## Zero-State Behavior

When journal is empty or API fails:

| Field | Value |
|-------|-------|
| `currentEquity` | 1000 |
| `targetEquity` | 10000 |
| `progressPct` | 0 |
| Trades open / closed | 0 / 0 |
| `netPnl` | 0 |
| Evidence | 0/12 |
| `liveLocked` | true |
| Core health | OK (or error payload with zero fallbacks) |

`useProjectionBundle()` returns zero-state on fetch failure — no permanent Loading.

---

## Remaining Legacy Dependencies

| Consumer | Legacy API | Reason |
|----------|------------|--------|
| Dashboard | `/api/core/ui/context` | Preview, swarm, reconciliation, exec safety (non-critical) |
| Reports | `/api/reports/summary` | Briefing, audit pack, replay, execution gate |
| AI Status | `/api/analysis/latest`, `/api/execution/review/latest`, `/api/journal/events` | Advisory + journal tail |
| Settings | `/api/health/engine`, production health actions | Diagnostics labeled legacy |
| Operator | `/api/operator/*` | Control plane actions |

Legacy APIs **not removed** per Slice 7 scope.

---

## Known Risks

1. Reports still mixes projection primary stats with legacy summary sections.
2. UI context is not a registered projection — parity with mission snapshot must be monitored.
3. Trace API exists but AI Status uses journal event filtering for lifecycle display.
4. Consistency endpoint is manual/CI — not polled by UI.

---

## Manual Verification Notes

1. Open `/` with empty journal — equity $1,000, progress 0%, evidence 0/12, no infinite loading.
2. Open `/trades` — empty lists, summary zeros.
3. Open `/reports` — projection stat cards; legacy sections labeled where applicable.
4. Open `/settings` — core health + live locked stat cards; Binance panel populated.
5. `GET /api/core/ui-consistency` — status `OK` on fresh journal.
6. Execute one paper trade — dashboard and trades counts align.

---

## Slice 8 Recommendation

1. Add automated parity tests: projection bundle vs `/api/mission/snapshot` and `/api/reports/summary`.
2. Deprecate UI usage of legacy snapshot entirely; fold ui-context fields into projections where critical.
3. Wire `/api/core/trace/[id]` on AI Status when `tradeId` present.
4. Run `/api/core/ui-consistency` in CI after each deploy.
5. Block execute on `evaluateCoreHealth().status === BLOCKED` (hot-path integration).

---

## Acceptance Criteria Checklist

- [x] Dashboard reads projections
- [x] Trades reads projections
- [x] AI Status reads projections/trace sources
- [x] Reports reads projections (primary)
- [x] Settings reads shared status/projections
- [x] No core page stuck on Loading (zero-state on error)
- [x] No UI computes critical PnL/evidence/trade count state
- [x] `/api/core/ui-consistency` exists
- [x] No live trading enabled
- [x] No secret exposure in UI pages
- [x] `docs/CORE_ENGINE_SLICE7_UI_PROJECTIONS.md` exists
- [x] `docs/CORE_ENGINE_SLICE7_UI_PROJECTION_AUDIT.md` exists
- [x] `npm run build` passes
- [x] Full test suite — **206/206 pass** (includes `projection-ui.test.ts`)
