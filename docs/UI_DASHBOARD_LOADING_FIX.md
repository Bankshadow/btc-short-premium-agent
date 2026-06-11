# UI Dashboard Loading Fix

Branch: **`v2-core`**  
Date: **2026-06-11**  
Priority: **P1 — Dashboard `/` stuck on Loading**

---

## Root cause

Three client-side issues could leave the dashboard appearing stuck or non-interactive after hydration:

1. **Unstable `useApi` fallback** — `zeroDashboardUiContext()` was passed inline on every render, changing object identity and retriggering the `useApi` effect in a loop while `/api/core/ui/context` (~5s on Vercel) kept refetching.
2. **Eight parallel projection fetches** — `getProjectionBundle()` called seven projection routes plus Binance instead of the single `/api/core/projections/bundle` endpoint, increasing timeout risk and client work.
3. **No hard 5s render deadline** — slow or hung fetches could leave the dashboard in a `refreshing` state without surfacing the required zero-state warning message.

The dashboard page itself did not use `LoadingOrError`, but unstable hooks and slow API fan-out caused production to look stuck after client hydration.

---

## Files changed

| File | Change |
|------|--------|
| `src/app/page.tsx` | Stable `useMemo` fallback for ui/context; use bundle `binanceStatus` when context slow |
| `src/components/use-api.tsx` | Stable fallback via `useRef`; invalidate in-flight fetches on cleanup; never block when fallback exists |
| `src/components/use-projection-bundle.tsx` | 5s `DASHBOARD_RENDER_DEADLINE_MS`; zero-state first; `timedOut` flag |
| `src/lib/core/projection-client.ts` | Bundle-first fetch from `/api/core/projections/bundle` + `/api/binance/status` |
| `src/lib/core/projection-defaults.ts` | `DASHBOARD_RENDER_DEADLINE_MS`, `PROJECTION_UNAVAILABLE_MESSAGE` |
| `src/components/ui/projection-warning.tsx` | Exact warning copy |
| `src/lib/core/ui-dashboard-loading-fix.test.ts` | New regression tests |
| `src/lib/core/production-loading-fix.test.ts` | Updated bundle API mock |

---

## Fallback behavior

| Condition | Dashboard behavior |
|-----------|-------------------|
| Initial mount | Renders `getDefaultProjectionBundle()` immediately (equity 1000, evidence 0/12, liveLocked true) |
| Bundle succeeds | Shows projection data from `/api/core/projections/bundle` + Binance status |
| Bundle fails / timeout / invalid JSON | Shows safe zero-state + banner: **"Projection unavailable. Showing safe zero-state."** |
| After 5 seconds | Hard deadline clears `refreshing`; zero-state remains visible with warning |
| `/api/core/ui/context` slow | Non-blocking; supplemental panels use stable zero context until loaded |

Zero-state values:

- `currentEquity = 1000`, `targetEquity = 10000`, `progressPct = 0`
- `totalTrades = 0`, `open = 0`, `closed = 0`, `netPnl = 0`
- `evidence = 0/12`, `liveLocked = true`
- `coreHealth = OK`, `binanceStatus = MISSING_ENV` (or actual status)

---

## Test result

```
npm test  → ui-dashboard-loading-fix.test.ts (5 tests)
npm run build → pass
```

Coverage:

- Bundle failure → zero-state
- Bundle success → projection data
- Dashboard never gates on `LoadingOrError`
- No secrets in dashboard page
- Live remains locked

---

## Remaining risk

| Risk | Mitigation |
|------|------------|
| `/api/core/ui/context` still slow (~5s) | Non-blocking; dashboard renders from bundle/defaults first |
| Bundle API slow (~4s on Vercel) | 4s fetch timeout + 5s UI deadline + zero-state |
| Operator page still uses `LoadingOrError` | Out of scope for dashboard fix |
| Journal lifecycle gaps in production data | Data repair separate from UI loading |

---

## Verify post-deploy

```bash
curl https://btc-short-premium-agent.vercel.app/api/core/boot-check
curl https://btc-short-premium-agent.vercel.app/api/core/projections/bundle
```

Open `/` — mission metrics, safety panel, and evidence progress should appear within 5 seconds even when APIs are slow.
