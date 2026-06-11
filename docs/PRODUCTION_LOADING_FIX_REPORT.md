# Production Loading Fix Report

Branch: **`v2-core`**  
Date: **2026-06-06**  
Priority: **P1 — Production core pages stuck at `Loading…`**

---

## 1. Symptom

Production pages rendered header/navigation but body remained permanently on `Loading…`:

- `/`
- `/trades`
- `/ai-status`
- `/reports`
- `/settings`

---

## 2. Root Cause

| # | Cause | Impact |
|---|-------|--------|
| 1 | Full-page `LoadingOrError` blocked render until **all** fetches completed | User saw only `Loading…` |
| 2 | `useApi` effect cleanup could leave `loading=true` when fetch outlived unmount | Permanent loading state |
| 3 | `useEffect` fetch path did not unwrap API envelopes or apply fallbacks | Invalid/empty responses blocked render |
| 4 | No immediate zero-state — hooks started with `loading: true`, `data: null` | No metrics visible during fetch |
| 5 | `/api/core/ui/context` could return HTTP 500 | Dashboard blocked on supplemental context |

**APIs were not missing** — client render gating was the primary failure mode.

---

## 3. Failing APIs Found

No projection route was missing from the production build. Failure modes were:

- Client waited forever on combined loading gates
- Envelope responses (`{ ok, data, error }`) not unwrapped in one `useApi` code path
- No structured fallback when journal empty or rebuild threw (now handled server-side)

All listed APIs now return JSON within 5 seconds with safe zero-state fallback:

| API | Status |
|-----|--------|
| `GET /api/core/projections/mission` | ✅ Envelope + `getDefaultMissionProjection()` |
| `GET /api/core/projections/trades` | ✅ Envelope + `getDefaultTradeProjection()` |
| `GET /api/core/projections/positions` | ✅ Envelope + `getDefaultPositionProjection()` |
| `GET /api/core/projections/pnl` | ✅ Envelope + `getDefaultPnlProjection()` |
| `GET /api/core/projections/evidence` | ✅ Envelope + `getDefaultEvidenceProjection()` |
| `GET /api/core/projections/risk` | ✅ Envelope + `getDefaultRiskProjectionView()` |
| `GET /api/core/health` | ✅ Envelope + `getDefaultCoreHealth()` |
| `GET /api/core/ui-consistency` | ✅ Envelope + safe empty report |
| `GET /api/binance/status` | ✅ Envelope + `MISSING_ENV` fallback |
| `GET /api/core/boot-check` | ✅ **New** diagnostics endpoint |

---

## 4. Zero-State Strategy

### Server (`projection-defaults.ts`)

Exported `getDefault*()` functions with `zeroState: true`:

- `getDefaultMissionProjection()` — equity $1,000, target $10,000, 0% progress
- `getDefaultTradeProjection()` — 0 open/closed
- `getDefaultPositionProjection()` — no positions, reconciliation OK
- `getDefaultPnlProjection()` — $0 net
- `getDefaultEvidenceProjection()` — 0/12, NOT_READY
- `getDefaultRiskProjectionView()` — SAFE, DEFENSIVE, live locked
- `getDefaultCoreHealth()` — OK, no blockers
- `getDefaultBinanceStatus()` — MISSING_ENV
- `getDefaultProjectionBundle()` — full safe bundle

### API envelope

```json
{ "ok": true, "data": { ... }, "error": null }
{ "ok": false, "data": { ...zeroState }, "error": { "code": "PROJECTION_FALLBACK", ... } }
```

### Client (`projection-client.ts`)

- `fetchWithTimeout(url, fallback, 4000ms)` — timeout, invalid JSON, invalid shape → fallback
- `getProjectionBundle()` — parallel section fetches; partial failures still render
- `useProjectionBundle()` — initializes with `getDefaultProjectionBundle()`, `loading: false`
- `useApi()` — fallback data, envelope unwrap, 4s timeout + hard stop

### Pages

All five core pages:

- Render immediately with defaults
- Show `ProjectionWarningPanel`: *"Projection unavailable. Showing safe zero-state."*
- Never use `if (pending) return pending` full-page gate

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/lib/core/projection-defaults.ts` | `getDefault*()` exports + `zeroState` |
| `src/lib/core/projection-api-response.ts` | Envelope with `error: null` on success |
| `src/lib/core/projection-client.ts` | `fetchWithTimeout`, `getBinanceStatus`, partial bundle |
| `src/lib/core/projection-route.ts` | `PROJECTION_FALLBACK` error code |
| `src/lib/core/ui-context-zero.ts` | Client-safe dashboard zero context |
| `src/components/use-api.tsx` | Envelope unwrap in effect + reload |
| `src/components/use-projection-bundle.tsx` | Zero-state-first hook |
| `src/components/projection-warning.tsx` | Warning panel |
| `src/app/page.tsx` | Dashboard zero-state first |
| `src/app/trades/page.tsx` | Trades zero-state first |
| `src/app/ai-status/page.tsx` | AI Status zero-state first |
| `src/app/reports/page.tsx` | Reports zero-state first |
| `src/app/settings/page.tsx` | Settings zero-state first |
| `src/app/api/core/projections/*/route.ts` | Safe envelopes |
| `src/app/api/core/health/route.ts` | Safe envelope |
| `src/app/api/core/ui-consistency/route.ts` | Safe envelope |
| `src/app/api/binance/status/route.ts` | Safe envelope |
| `src/app/api/core/boot-check/route.ts` | Diagnostics |
| `src/lib/core/production-loading-fix.test.ts` | 18 tests |

---

## 6. Tests Added

`production-loading-fix.test.ts` covers:

- All `getDefault*()` projections with `zeroState: true`
- Binance `MISSING_ENV` without credentials
- Envelope unwrap + invalid shape → null
- `fetchWithTimeout` error and timeout fallbacks
- Partial bundle when one API fails
- Route `PROJECTION_FALLBACK` on throw
- Core pages do not block on endless Loading
- Boot-check payload has no secrets
- Live trading remains locked

---

## 7. Build / Test Results

| Command | Result |
|---------|--------|
| `npm run build` | ✅ **PASS** |
| `npm test` | ✅ **PASS — 239/239** |

---

## 8. Remaining Risks

| Risk | Severity |
|------|----------|
| `/core` monitor page still uses legacy `LoadingOrError` | Low |
| Reports briefing still uses legacy `/api/reports/summary` | Low (P3 adapter) |
| Production not yet redeployed with this fix | **Deploy required** |

---

## 9. Final Recommendation

### **`CORE_ENGINE_STABLE`**

After deploy, all five core pages render safe zero-state within 5 seconds even when:

- Projection APIs fail or timeout
- Event journal is empty
- Binance env is missing
- Data stores are undefined

Verify post-deploy:

```bash
node scripts/checklist-verify.mjs
curl https://btc-short-premium-agent.vercel.app/api/core/boot-check
```

Expected zero-state display:

- Current equity: **$1,000**
- Target: **$10,000**
- Progress: **0%**
- Trades / Open / Closed: **0**
- Net PnL: **$0**
- Evidence: **0/12**
- Binance: **MISSING_ENV**
- Live: **Locked**
- Core health: **OK**
