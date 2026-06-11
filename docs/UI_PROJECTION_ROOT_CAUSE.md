# UI Projection Root Cause

**Branch:** `v2-core`  
**Symptom:** `/api/core/projections/bundle` returns `mission.totalTrades = 8` and `trades.closed.length = 8`, but Dashboard, Trades, and Core pages rendered `0` trades and Core showed health `OK` instead of `WARNING`.

**Conclusion:** The API used the server projection builder (`buildProjectionBundle()`). The rendered UI did not. It used a separate client-only path that started from zero-state defaults and often never upgraded to the real bundle.

---

## Architecture (broken — Hotfix 7 / pre–Hotfix 8)

```
GET /api/core/projections/bundle
  └─ buildProjectionBundle()          ← server, journal at request time → 8 trades

Browser UI pages
  └─ ProjectionBundleProvider
       ├─ useState(getDefaultUiProjectionData())   ← totalTrades=0, source=FALLBACK
       └─ useEffect → getUiProjectionData()
            └─ getProjectionBundleForUI()
                 └─ fetch("/api/core/projections/bundle")   ← second hop, can fail/timeout
```

The API and UI *intended* to share the same bundle, but they ran on different runtimes (server route vs browser fetch) with different timing and failure modes.

---

## Per-page trace (broken state)

### 1. Dashboard — `src/app/page.tsx`

| Question | Answer |
|----------|--------|
| **Load function / API** | `useUiProjectionData()` from `ProjectionBundleProvider` for mission/trades/evidence/health. Secondary: `useApi("/api/core/ui/context")` for previews, lifecycle, reconciliation only. |
| **Default projection directly?** | Yes, indirectly. Provider initialized with `getDefaultUiProjectionData()` before client fetch completed. |
| **Stale mock / local state?** | Yes. Initial render and failed fetches kept `source=FALLBACK`, `totalTrades=0`. `useApi` also had `zeroDashboardUiContext()` fallback for context panel (not trade counts). |
| **Fetches `/api/core/projections/bundle`?** | Not from the page. Provider called it via `getUiProjectionData()` → `getProjectionBundleForUI()` on mount. |
| **Unwraps response correctly?** | Yes, when fetch succeeded — `normalizeProjectionBundle(raw)` + `unwrapApiData()` handle `{ ok, data }` envelope. |
| **Why 0 instead of 8?** | Page bound to provider state. Provider started at zero-state; client fetch could fail (timeout, cold start, network) and left `isFallback=true`. Metrics used `ui.mission.totalTrades` which stayed `0`. |

### 2. Trades — `src/app/trades/page.tsx`

| Question | Answer |
|----------|--------|
| **Load function / API** | `useUiProjectionData()` only. |
| **Default projection directly?** | Yes, via provider zero-state init. |
| **Stale mock / local state?** | Yes. `ui.trades.closed` empty until successful client bundle fetch. |
| **Fetches `/api/core/projections/bundle`?** | Indirectly through provider on mount. |
| **Unwraps response correctly?** | Same as Dashboard — correct when fetch succeeds. |
| **Why 0 instead of 8?** | Closed list rendered from `ui.trades.closed.map(...)`. Fallback bundle has `closed=[]` and `closedTrades=0`. No server-side hydration of real trades. |

### 3. Core — `src/app/core/page.tsx`

| Question | Answer |
|----------|--------|
| **Load function / API** | `useUiProjectionData()` for trades/health. Also `useApi("/api/core/health")`, `useApi("/api/core/ui-consistency")`, `useApi("/api/core/projection-parity")`. |
| **Default projection directly?** | Yes for bundle fields. `getDefaultCoreHealth()` fallback for `/api/core/health` when that fetch failed. |
| **Stale mock / local state?** | Yes. Health display used: `ui.source === "REAL_BUNDLE" ? ui.health.status : (coreHealth.data?.status ?? ui.health.status)`. When bundle was FALLBACK, page showed `/api/core/health` (often `OK`) instead of bundle `WARNING`. |
| **Fetches `/api/core/projections/bundle`?** | Indirectly through provider. |
| **Unwraps response correctly?** | Bundle path: yes when fetch succeeds. Health merge logic masked bundle health when fallback active. |
| **Why 0 trades / OK health?** | Trade counts from fallback bundle (`0 open / 0 closed`). Health overridden to `OK` from separate health API when `ui.source !== "REAL_BUNDLE"`. |

### 4. Reports — `src/app/reports/page.tsx`

| Question | Answer |
|----------|--------|
| **Load function / API** | `useUiProjectionData()` for mission/evidence/health/Binance panel. Legacy `useApi("/api/reports/summary")` for supplemental sections only. |
| **Default projection directly?** | Yes for projection sections via provider fallback. `zeroReportsSummary()` for legacy report blocks. |
| **Stale mock / local state?** | Yes. Evidence progress and trade counts came from provider; when fallback, `ui.evidence.valid=0` with empty `ui.evidence.trades`. |
| **Fetches `/api/core/projections/bundle`?** | Indirectly through provider. |
| **Unwraps response correctly?** | Bundle path: yes when fetch succeeds. Legacy report path unrelated to trade count mismatch. |
| **Why 0 instead of 8?** | Mission/evidence cards used `ui.mission.totalTrades` and `ui.evidence.*` from fallback provider state. Rejection reasons empty because `ui.evidence.trades` was empty in zero-state. |

---

## Root causes (ranked)

1. **Different data path than the API.** UI never called `buildProjectionBundle()` on the server for first paint. It relied on a browser round-trip that could fail independently of the working JSON API.

2. **Zero-state initialization.** `ProjectionBundleProvider` used `getDefaultUiProjectionData()` (`totalTrades=0`, `source=FALLBACK`) as initial state, so first paint and failed fetches always showed zeros.

3. **Client fetch failure modes.** `getProjectionBundleForUI()` catches fetch errors and returns `normalizeProjectionBundle(null)` → full fallback. Production cold starts and timeouts left UI on fallback while direct API navigation still worked.

4. **Health override on Core (secondary).** When bundle was fallback, Core merged `/api/core/health` default `OK` over the bundle’s `WARNING`, hiding the real health signal.

5. **Static layout risk (without `force-dynamic`).** A server layout that calls `getUiBundle()` without `dynamic = 'force-dynamic'` can bake an empty journal snapshot at build time into static HTML on Vercel.

---

## Fix (Hotfix 8 — minimal scope)

Single server-safe loader shared with the API route:

```typescript
// src/lib/core/get-ui-bundle.ts
export async function getUiBundle() {
  const bundle = await buildProjectionBundle();  // same as GET /api/core/projections/bundle
  const normalized = normalizeProjectionBundle(bundle, { binanceStatus, errors });
  return mapNormalizedToUiProjectionData(normalized, { source: "REAL_BUNDLE" | "FALLBACK" });
}
```

Wiring:

| File | Change |
|------|--------|
| `src/app/layout.tsx` | `await getUiBundle()` → pass `initialUiBundle` to `AppShell`. Add `export const dynamic = "force-dynamic"`. |
| `src/components/AppShell.tsx` | Forward `initialUiBundle` to `ProjectionBundleProvider`. |
| `src/components/projection-bundle-provider.tsx` | Seed state from `initialUiBundle`; skip initial client fetch when `source === "REAL_BUNDLE"`; do not downgrade REAL_BUNDLE → FALLBACK on failed refresh. |
| `src/app/page.tsx` | Metrics from `ui.mission.*`, health from `ui.health.status` (no ctx fallback for counts). |
| `src/app/trades/page.tsx` | Already uses `ui.trades.closed` — benefits from server seed. |
| `src/app/core/page.tsx` | Health from `ui.health.status` only (removed health API override for display). |
| `src/app/reports/page.tsx` | Evidence from `ui.evidence` + `aggregateEvidenceRejectionReasons()`. |

Data flow after fix:

```
layout.tsx (server, force-dynamic)
  └─ getUiBundle() → buildProjectionBundle()
       └─ AppShell → ProjectionBundleProvider(initialUiBundle)
            └─ useUiProjectionData() on all four pages
```

Client refresh still calls `getUiProjectionData()` → `/api/core/projections/bundle`, but only to update — not to establish initial truth.

---

## Acceptance mapping

| Check | Expected after fix |
|-------|-------------------|
| Dashboard `totalTrades` | `8` from `ui.mission.totalTrades` |
| Trades closed count / list | `8` from `ui.mission.closedTrades` / `ui.trades.closed.length` |
| Core health | `WARNING` from `ui.health.status` (bundle-derived) |
| Reports evidence | Rejection badges from `ui.evidence.trades` |
| No new features | Loader + wiring only |
| `npm run build` | Passes |

---

## Files reference

| Role | Path |
|------|------|
| Server loader (fix) | `src/lib/core/get-ui-bundle.ts` |
| API route (unchanged builder) | `src/app/api/core/projections/bundle/route.ts` |
| Client fetch (refresh only) | `src/lib/core/projection-client.ts` |
| Normalization | `src/lib/core/normalize-projection-bundle.ts` |
| UI shape mapping | `src/lib/core/ui-projection-data.ts` |
| React context | `src/components/projection-bundle-provider.tsx` |
