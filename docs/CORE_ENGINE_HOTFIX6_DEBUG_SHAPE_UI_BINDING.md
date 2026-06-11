# Core Engine Hotfix 6 — Debug Shape + UI Binding

## Actual bundle response shape

Production `/api/core/projections/bundle` returns:

```json
{
  "ok": true,
  "data": {
    "ok": true,
    "mission": { "totalTrades": 8, "...": "..." },
    "trades": {
      "open": [],
      "closed": [ "...8 items..." ],
      "effectiveOpenCount": 0,
      "closedCount": 8
    },
    "positions": {},
    "pnl": {},
    "evidence": { "valid": 0, "required": 12 },
    "risk": { "liveLocked": true },
    "health": { "status": "WARNING" },
    "meta": { "eventCount": 699, "builtAt": "...", "cacheKey": "699" }
  },
  "error": null
}
```

Diagnostic endpoint: `GET /api/core/projections/debug-shape` — redacted shape summary only (no secrets, no full payload).

## Root cause

1. **Client normalization bug** — `normalizeProjectionBundle` called `getDefaultTradeProjection()` without importing it, causing runtime failures and silent fallback to zero-state in the browser.
2. **Fragile unwrap path** — UI relied on multiple competing unwrap helpers; production uses a nested `{ ok, data: { ok, mission, trades, ... } }` envelope.
3. **Reports Binance panel** — rendered legacy `reportData.binanceStatus` from `/api/reports/summary`, which defaults to `MISSING_ENV` even when server env keys exist.
4. **No runtime visibility** — no safe way to confirm whether pages consumed `REAL_BUNDLE` vs `FALLBACK`.

## Projection client fix

- Added `projection-bundle-shape.ts` — `inspectProjectionBundleShape`, `extractProjectionBundlePayload`, `bundlePayloadReady`.
- Added `normalize-projection-bundle.ts` — `normalizeProjectionBundle(raw)` produces one stable shape with `isFallback` only when fetch/JSON/mission/trades fail.
- Rewrote `getProjectionBundleForUI()` to normalize first, expose `debugSource: REAL_BUNDLE | FALLBACK`.
- Fixed missing `getDefaultTradeProjection` import (runtime crash).

## Pages fixed

| Page | Change |
|------|--------|
| Dashboard | Uses normalized bundle via provider; compact **Projection source** diagnostic banner |
| Trades | Uses `useProjectionBundle` closed/open counts |
| Reports | Mission/evidence/health from bundle; Binance panel uses `bundleBinance` |
| Core | Bundle trade/evidence counts + API consistency/parity/health |
| Settings | Already used bundle Binance (unchanged) |

## Binance status fix

- `resolveBinanceStatusConsistency()` — `MISSING_ENV` only when `apiKeyPresent` or `apiSecretPresent` is false; when keys present, never `MISSING_ENV` (maps to `DISCONNECTED` if probe incomplete).
- Reports/Dashboard/Settings display normalized bundle Binance status from `/api/binance/status` probe path.

## Evidence strictness status

Strict validator unchanged and verified:

- Rejects `PENDING_PNL`, `CLOSED_PENDING_PNL`, missing `PNL_REALIZED`, missing entry price, zero qty.
- Production evidence: `0/12` valid (8 trades rejected as pending PnL).

## Build / test result

Run locally:

```bash
npm test
npm run build
```

Hotfix 6 adds `core-engine-hotfix6.test.ts` covering debug-shape safety, normalization, dashboard/reports binding, Binance consistency, evidence strictness, and live lock.

## Remaining blockers

- **CORE_ENGINE_PARTIAL** until production deploy confirms Dashboard banner shows `REAL_BUNDLE` with `totalTrades=8`.
- UI consistency / projection parity may still report WARNING while PnL data is pending — expected until trades have realized PnL.
- Live trading remains locked (`liveLocked: true`).
