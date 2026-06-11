# Core Engine Hotfix 7 — UI Real Bundle Binding

## Problem

Production `/api/core/projections/bundle` returned real data (`totalTrades=7`, `closed.length=7`, `health=WARNING`, `evidence=0/12`) but UI pages still showed zero-state fallback values and `MISSING_ENV` Binance status when API keys were present.

Root causes:

1. **No single canonical UI loader** — pages mixed bundle provider state, legacy fallbacks, and per-page unwrap logic.
2. **Fallback over-triggering** — binance fetch errors and `bundle.ok` heuristics could mark REAL bundle as FALLBACK.
3. **Health override** — Core/Reports merged `/api/core/health` fallback (`OK`) over bundle `WARNING`.
4. **Binance display** — Settings/AI Status used raw API fallbacks with `MISSING_ENV` despite `apiKeyPresent=yes`.

## Solution

### Canonical loader: `getUiProjectionData()`

File: `src/lib/core/ui-projection-data.ts`

- Fetches and normalizes bundle via existing `getProjectionBundleForUI`.
- Returns stable shape with `source: REAL_BUNDLE | FALLBACK`.
- `isFallback=false` whenever mission + trades exist in bundle (never zero-state for valid bundle).
- Preserves mission counts, closed trades, evidence, health, stale warnings, risk.

### Provider rewrite

`ProjectionBundleProvider` now loads `getUiProjectionData()` once and exposes:

- `useUiProjectionData()` — primary hook for all pages
- `useProjectionBundle()` — compatibility shim

### Binance normalization

File: `src/lib/binance/normalize-binance-status.ts`

- `MISSING_ENV` only when keys missing.
- Keys present → never `MISSING_ENV`; incomplete probe → `DISCONNECTED`.
- Preserves `PROXY_UNHEALTHY`, `AUTH_ERROR`, `API_ERROR`.

### Pages updated

| Page | Binding |
|------|---------|
| Dashboard `/` | `ui.mission.*`, `ui.health.status`, `ui.binanceStatus`, projection source banner |
| Trades `/trades` | `ui.trades.closed`, PnL pending labels |
| Core `/core` | Bundle health when REAL_BUNDLE; projection source banner |
| Reports `/reports` | Mission/evidence/health + normalized Binance |
| Settings `/settings` | `binanceStatusForUiPanel` |
| AI Status `/ai-status` | `binanceStatusForUiPanel` |

### Stale trade warnings

Compact banner: *"1 stale trade requires manual repair. Not counted as active exposure."*

Core page shows tradeId, projectedStatus, recommendation. Stale trades not counted as open exposure.

## Expected production UI

- Dashboard: `Projection source: REAL_BUNDLE`, totalTrades=7, closedTrades=7, health=WARNING
- Trades: 7 closed rows, PnL pending labels
- Core: 0 open / 7 closed, health=WARNING
- Settings/AI Status: Binance not `MISSING_ENV` when keys present
- Evidence: 0/12 (strict — pending PnL rejected)

## Tests

`src/lib/core/core-engine-hotfix7.test.ts` — loader, binance normalization, page binding, stale warning, live lock.

Run:

```bash
npm test
npm run build
```

## Remaining blockers

- **CORE_ENGINE_PARTIAL** until production deploy confirms REAL_BUNDLE on all pages.
- UI consistency may remain WARNING while 1 stale open trade exists (expected).
- Live trading remains locked.
