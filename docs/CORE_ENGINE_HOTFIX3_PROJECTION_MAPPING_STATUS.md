# Core Engine Hotfix 3 — Projection Mapping + Binance Status

Branch: **`v2-core`**  
Date: **2026-06-11**  
Priority: **P1 — Dashboard zeros, Binance MISSING_ENV inconsistency, stale trade UX**

---

## Root cause

| Issue | Cause |
|-------|--------|
| Dashboard `totalTrades=0` while bundle shows 7 | Default bundle `ok:true` with zero-state masked real values; dashboard did not use centralized mapping when fallback active |
| Binance `MISSING_ENV` + keys present | `defaultBinanceTestnetStatus()` left status `MISSING_ENV` when keys exist but probe not run |
| ui-consistency hard mismatch on stale trade | `stale_open_trades` counted as blocking mismatch |
| PnL pending unclear | Inconsistent copy across Trades/Reports |

---

## Fixes

### Part 1 — Dashboard projection mapping

- `src/lib/core/dashboard-projection-map.ts` — `mapBundleToDashboardMetrics()`
- Dashboard uses bundle mission/trades/pnl/evidence when `bundle.ok=true`
- Shows **"Projection fallback active."** when fallback used

### Part 2 — Bundle unwrapping

- `unwrapApiData()` — nested `{ ok, data: { ok, mission, ... } }` and `{ ok:false, data:fallback }`
- `extractBundlePayload()` strips envelope `ok`/`meta`/`error`

### Part 3 — Binance status consistency

- `resolveBinanceStatusConsistency()` — never `MISSING_ENV` when keys present
- `defaultBinanceTestnetStatus()` — keys present → `DISCONNECTED` until probe completes
- Settings page resolves inconsistent API + bundle health display

### Part 4 — Stale trade UX

- `stale-trade-display.ts` — banner + required action copy
- Dashboard, `/core`, `/trades`, `/reports` show manual repair message
- `/core` lists tradeId, projectedStatus, recommendation, requiredAction

### Part 5 — PnL pending clarity

- `PNL_PENDING_LABEL = "PnL pending — missing fill data."`
- No auto `PNL_REALIZED` for missing fills

### Part 6 — ui-consistency

- Check id: `STALE_TRADE_MANUAL_REPAIR_REQUIRED`
- Excluded from hard `mismatches`; overall status stays **WARNING**

### Part 7 — Tests

- `src/lib/core/core-engine-hotfix3.test.ts` (14 cases)

---

## Remaining blockers for CORE_ENGINE_STABLE

| Blocker | Status |
|---------|--------|
| All core pages load | ✅ |
| Dashboard matches bundle when API OK | ✅ after deploy |
| Binance status logically consistent | ✅ |
| Stale trade safely excluded | ✅ |
| Evidence < 12 | Expected — collecting |
| `SKIPPED_LIFECYCLE_STEP` from repair backfill | Non-blocking WARNING |

**Recommendation:** `CORE_ENGINE_STABLE` after production verify. `CORE_ENGINE_PARTIAL` if dashboard still shows fallback zeros with healthy bundle.

---

## Safety preserved

- Live trading locked
- No fake PnL
- No secrets in UI/API payloads tested
