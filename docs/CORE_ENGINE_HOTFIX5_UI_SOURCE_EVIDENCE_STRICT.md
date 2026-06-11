# Core Engine Hotfix 5 — UI Projection Source + Strict Evidence

Branch: **`v2-core`**  
Date: **2026-06-06**

---

## 1. Root cause

Production `/api/core/projections/bundle` returned real data (8 trades, 8 closed) but UI pages showed zeros and "Projection fallback active."

| Layer | Issue |
|-------|-------|
| **Architecture** | Each page mounted its own `useProjectionBundle()` — no shared state; navigation reset to zero-state |
| **Client unwrap** | Bundle treated as fallback when `ok` flags disagreed, even with mission+trades present |
| **Dual sources** | `useApi` fallbacks with `summary` competed with bundle on Trades |
| **Count mapping** | `closedCount ?? closed.length` returned 0 when `closedCount=0` but array had 8 items |
| **Evidence** | Zero-fill / `CLOSED_PENDING_PNL` trades counted valid (8/12) despite missing fill data |

---

## 2. `getProjectionBundleForUI()`

New primary UI loader in `projection-client.ts`:

```typescript
{
  bundle,
  isFallback: false,  // when mission + trades exist
  errors: [],
  warnings: []        // no PROJECTION_FALLBACK_ACTIVE when valid
}
```

Rules:
- Unwrap `{ ok, data: { ok, mission, trades, ... } }`
- Valid when **mission and trades exist** (not only when all `ok` flags align)
- Fallback only on fetch failure, invalid JSON, or missing mission/trades
- Binance failure is non-blocking

---

## 3. Shared `ProjectionBundleProvider`

Mounted once in `AppShell` — all pages consume the same bundle:

- Dashboard, Trades, Reports, Core share one fetch
- Navigation does not reset to zero-state
- Exposes `isFallback`, `loading`, `ready`, `reload`

---

## 4. Page binding fixes

| Page | Source | Key metrics |
|------|--------|-------------|
| Dashboard | `mapBundleToDashboardMetrics` | totalTrades, open, closed, evidence, health |
| Trades | `bundle.trades` only (no useApi) | executions, open, closed rows |
| Reports | bundle mission/evidence/pnl/health | trades, strict evidence, pending PnL count |
| Core | bundle + `/api/core/health` | trades open/closed, evidence, WARNING, warning count |

Fallback warning shown only when `isFallback && !loading`.

---

## 5. Strict evidence validator

`validateTradeEvidence()` now also checks closed trade projection:

Rejects when:
- `status = CLOSED_PENDING_PNL`
- `result = PENDING_PNL`
- `pnlStatus = PENDING_DATA`
- `entryPrice` null, `exitPrice` null, `qty = 0`
- `PNL_REALIZED` missing or `ZERO_FILL_RECONCILIATION`
- incomplete lifecycle

Expected with current journal:
- **evidence.valid = 0**
- **rejected = 8**
- Reasons: `PNL_PENDING_DATA`, `MISSING_ENTRY_PRICE`, `ZERO_QTY`, `MISSING_REALIZED_PNL`

Does **not** fake `PNL_REALIZED`.

---

## 6. UI consistency note

`GET /api/core/ui-consistency` now includes:

```json
{
  "browserDomChecksAvailable": false,
  "note": "This endpoint validates projection consistency, not rendered DOM values."
}
```

Server-side projection checks only — dashboard DOM and reports page checks remain skipped by design.

---

## 7. Tests

`src/lib/core/core-engine-hotfix5.test.ts` — 12 tests covering unwrap, `getProjectionBundleForUI`, dashboard mapping, strict evidence, ui-consistency note, provider, no secrets.

---

## 8. Remaining blockers

| Blocker | Notes |
|---------|-------|
| Real fill data for 8 trades | Required for evidence > 0 |
| `SKIPPED_LIFECYCLE_STEP` health WARNING | Non-blocking for testnet |
| Production deploy | Required for UI fix to take effect |

---

## 9. Recommendation

**`CORE_ENGINE_PARTIAL`** until production verifies UI shows 8/8 trades and evidence 0/12.

**`CORE_ENGINE_STABLE`** when:
- All UI pages display bundle values correctly
- Evidence rejects pending PnL trades
- Health status consistent
- No P0/P1 safety issue

---

## 10. Safety (unchanged)

- Live trading locked
- No Binance execution changes
- Safety gates unchanged
- No fake PnL
- No secret exposure
