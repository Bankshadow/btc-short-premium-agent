# Core Engine Hotfix 8 — Server/UI Binding to Projection Bundle

## Root cause

Production `/api/core/projections/bundle` returned correct data, but **rendered UI showed zeros** because:

1. **Client-only data path** — `ProjectionBundleProvider` initialized with `getDefaultUiProjectionData()` (all zeros) and fetched bundle via browser `fetch("/api/core/projections/bundle")`.
2. **Client fetch unreliable in production** — Timeouts, hydration races, or failed client fetches left the provider on FALLBACK zero-state even when the server API worked.
3. **Health override** — Core/Reports sometimes preferred `/api/core/health` fallback (`OK`) over bundle `WARNING`.
4. **Binance on Dashboard** — Client fallback `getDefaultBinanceStatus()` showed `MISSING_ENV` when client binance fetch failed; Settings worked because it called `/api/binance/status` directly with normalization.

The API was correct. The **rendered UI never received the server bundle on first paint**.

## Fix

### Server-side loader: `getUiBundle()`

File: `src/lib/core/get-ui-bundle.ts`

- Calls `buildProjectionBundle()` — same builder as `GET /api/core/projections/bundle`
- Fetches Binance status server-side via `getBinanceTestnetStatusBounded`
- Normalizes via `normalizeProjectionBundle` + `mapNormalizedToUiProjectionData`
- Returns `source: REAL_BUNDLE` when mission + trades exist
- No browser APIs

### Layout SSR injection

File: `src/app/layout.tsx` (async server component)

```tsx
const initialUiBundle = await getUiBundle();
<AppShell initialUiBundle={initialUiBundle}>{children}</AppShell>
```

### Provider update

File: `src/components/projection-bundle-provider.tsx`

- Accepts `initialUiBundle` from server
- Skips client fetch on mount when `source === REAL_BUNDLE"`
- Client refresh still available via `reload()` for manual updates

## Pages fixed

| Page | Binding |
|------|---------|
| Dashboard `/` | `ui.mission.*`, `ui.health.status`, projection source banner with runId/verdict |
| Core `/core` | Bundle health WARNING, rawWarningCount, 0 open / 8 closed, DOM note |
| Trades `/trades` | `ui.trades.closed` rows, PnL pending labels |
| Reports `/reports` | Evidence 0/12, rejected=8, rejection reason badges |
| Settings / AI Status | Unchanged — already normalized via Hotfix 7 |

## Before / after (expected production)

| Metric | Before (UI) | After (UI) | Bundle API |
|--------|-------------|------------|------------|
| totalTrades | 0 | 8 | 8 |
| closedTrades | 0 | 8 | 8 |
| openTrades | 0 | 0 | 0 |
| evidence | 0/12 (shown as 0) | 0/12 | 0/12 |
| health | OK (wrong) | WARNING | WARNING |
| source | FALLBACK | REAL_BUNDLE | — |
| Binance (Dashboard) | MISSING_ENV | DISCONNECTED/CONNECTED | — |

## Build / test

```bash
npm test
npm run build
```

Added: `core-engine-hotfix8.test.ts`

## Remaining blockers

- **CORE_ENGINE_PARTIAL** until production deploy confirms rendered UI matches bundle.
- `/api/core/health` may still report `SKIPPED_LIFECYCLE_STEP` warnings — documented as non-blocking for UI binding.
- Evidence remains 0/12 until trades have real fill data (strict validator — no fake PnL).
- Live trading remains locked.
