# Core Engine Hotfix 4 — UI Projection Binding + Evidence Strictness

Branch: **`v2-core`**  
Date: **2026-06-06**

---

## 1. Root cause

Production showed **"Projection fallback active."** and zero-state metrics on `/`, `/trades`, and `/reports` while `GET /api/core/projections/bundle` returned valid data (`totalTrades = 8`, `closed.length = 8`, `health.status = WARNING`).

Contributing issues:

1. **Bundle unwrap** — Client did not consistently unwrap nested `{ ok, data: { ok, mission, trades, … } }` envelopes; invalid unwrap triggered fallback defaults with `ok: false`.
2. **Fallback heuristics** — `mapBundleToDashboardMetrics` treated `mission.zeroState && trades.zeroState` as fallback even when real counts existed; `getProjectionBundle` required `hasRealMission` and added fallback warnings too aggressively.
3. **Trades page binding** — `if (data?.summary) return data` always preferred the `useApi` fallback (`getDefaultTradeProjection()` includes `summary`), ignoring the bundle.
4. **Core health mismatch** — `/core` preferred lightweight bundle health over `GET /api/core/health` (`WARNING` from `SKIPPED_LIFECYCLE_STEP`).
5. **Evidence too permissive** — Zero-fill / `CLOSED_PENDING_PNL` trades counted as valid evidence after journal repair.

---

## 2. Projection unwrapping fix

Added `unwrapProjectionBundle()` in `src/lib/core/unwrap-projection-bundle.ts`:

| Case | Shape | Result |
|------|-------|--------|
| A | `{ ok, data: { ok, mission, trades, … } }` | Valid when `mission` + `trades` present |
| B | `{ ok, data: { mission, trades, … } }` | Valid when `mission` + `trades` present |
| C | `{ ok: false, data: fallback, error }` | Invalid → client fallback |

`getProjectionBundle()` now:

- Unwraps via `unwrapProjectionBundle`
- Fetches bundle + Binance status in **parallel**
- Sets `ok: true` when bundle is valid (Binance failure is non-blocking)
- Adds `PROJECTION_FALLBACK_ACTIVE_MESSAGE` only when bundle is invalid or fetch fails

---

## 3. Dashboard binding fix

`mapBundleToDashboardMetrics()`:

- `usingFallback = !bundle.ok` only (no zero-state double-check)
- Exposes `coreHealthStatus` from `bundle.health.status`
- Maps `targetEquity` from `targetEquity ?? targetCapital`

Dashboard (`src/app/page.tsx`) uses `metrics.*` for all trade/evidence counts and `metrics.coreHealthStatus` for Core Safety panel.

---

## 4. Trades binding fix

`src/app/trades/page.tsx`:

- Uses `bundleProjectionReady()` before `useApi` fallback
- Counts from `pickOpenTradeCount` / `pickClosedTradeCount`
- Shows closed rows from `bundle.trades.closed`
- Retains `CLOSED_PENDING_PNL` / `PnL pending — missing fill data` labels

---

## 5. Reports binding fix

`src/app/reports/page.tsx`:

- Evidence from bundle projection (`projEvidence.valid` / `required`)
- Rejection reasons shown per trade
- Core health via `resolveCoreHealthStatus(/api/core/health, bundle.health)`

---

## 6. Evidence strictness change

`validateTradeEvidence()` now rejects trades unless:

- Full lifecycle events exist (including `PNL_REALIZED`, `LEARNING_RECORD_CREATED`)
- Result is `WIN` / `LOSS` / `BREAKEVEN`
- `entryPrice` and `exitPrice` are present and > 0
- `qty > 0`
- No `ZERO_FILL_RECONCILIATION` / pending PnL sources

Rejection reasons (unique per trade):

- `MISSING_REALIZED_PNL`
- `PNL_PENDING_DATA`
- `MISSING_ENTRY_PRICE`
- `MISSING_EXIT_PRICE`
- `ZERO_QTY`
- `MISSING_LEARNING_RECORD`
- `INCOMPLETE_LIFECYCLE`

**Does not** fake `PNL_REALIZED` or mark `PENDING_PNL` as valid.

Expected after fix: 8 zero-fill reconciliation trades → **0/12 valid**, 8 rejected with clear reasons.

---

## 7. Health status alignment

`resolveCoreHealthStatus(apiHealth, bundleHealth)` prefers API health.

- **Core page** — merges `/api/core/health` warnings (e.g. `SKIPPED_LIFECYCLE_STEP × 9`) with bundle metrics
- **Dashboard** — shows `bundle.health.status` (WARNING when bundle reports WARNING)
- **Reports** — Core health metric from API-first resolver

---

## 8. Tests added

`src/lib/core/core-engine-hotfix4.test.ts`:

- `unwrapProjectionBundle` Cases A/B/C
- Dashboard metrics without fallback when `bundle.ok`
- `getProjectionBundle` no fallback warning on valid nested bundle
- Trades bundle preference
- Strict evidence rejects PENDING_PNL, zero qty, missing entry
- Core/API health resolver
- No live trading / no secrets

Updated:

- `journal-repair.test.ts` — post-repair evidence is **REJECTED** under strict rules
- `core-partial-stability.test.ts` — `MISSING_REALIZED_PNL` reason code

---

## 9. Remaining blockers

| Blocker | Notes |
|---------|-------|
| Real fill data for 8 closed trades | Required for evidence progress beyond 0/12 |
| `SKIPPED_LIFECYCLE_STEP` health WARNING | From repair backfill; non-blocking for testnet |
| Production deploy | Requires Vercel redeploy of `v2-core` |
| Legacy `/api/reports/summary` evidence | Supplemental sections still reference legacy counts |

---

## 10. Safety constraints (unchanged)

- Live trading remains locked
- No Binance order behavior changes
- Risk / execution / close safety gates unchanged
- No fake PnL
- No secret exposure
