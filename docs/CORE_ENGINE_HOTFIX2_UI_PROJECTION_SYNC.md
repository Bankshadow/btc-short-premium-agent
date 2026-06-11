# Core Engine Hotfix 2 — UI / Projection Sync

Branch: **`v2-core`**  
Date: **2026-06-11**  
Priority: **P1 — Remaining pages Loading + projection mismatch + timeout APIs**

---

## Root cause

| Issue | Cause |
|-------|--------|
| `/trades`, `/ai-status`, `/reports`, `/settings` stuck Loading | Unstable `useApi` fallbacks recreated every render; some hooks had **no fallback** (sandbox, replay sessions); settings showed permanent "Loading sandbox status…" |
| Dashboard `totalTrades=0`, Binance `MISSING_ENV` while bundle OK | Client `unwrapProjectionData` did not normalize nested bundle `{ ok, data: { ok, mission, ... } }`; Binance fetch failure overwrote bundle health `exchangeStatus: CONNECTED`; ui/context fallback preferred over bundle |
| `/api/core/ui-consistency` timeout | `buildProjectionBundle()` called full `evaluateCoreHealth()` (Binance + duplicate projection rebuild) |
| `/api/core/projection-parity` timeout | Double journal read + legacy rebuild + `buildAllProjections` on every request |

---

## Pages fixed

| Page | Fix |
|------|-----|
| `/` | Prefer bundle Binance over ui/context; map `openTrades`/`closedTrades` from mission + effective open count |
| `/trades` | `useMemo` fallbacks; primary data from `useProjectionBundle`; enriched trades API supplemental |
| `/ai-status` | Stable `useMemo` fallbacks for all `useApi` hooks; bundle Binance preferred |
| `/reports` | `useMemo` reports fallback; replay sessions fallback `{ sessions: [] }` |
| `/settings` | Sandbox fallback; removed "Loading sandbox status…" gate |

---

## Dashboard mapping fix

`projection-client.ts` now:

- Uses `unwrapApiData()` for nested bundle envelopes
- Maps `mission.totalTrades`, `mission.openTrades`, `mission.closedTrades`, `pnl.totalNetPnl`
- Uses `trades.effectiveOpenCount` for reconciled open positions
- Derives Binance status from `health.exchangeStatus` when `/api/binance/status` fails
- Sets `ok: true` when real mission data present even if Binance section warns

---

## API timeout fix

| API | Change |
|-----|--------|
| `ui-consistency` | Uses `buildProjectionBundleFast()` — cached projections, lightweight health, no Binance |
| `projection-parity` | Bundle-only internal parity; skips legacy full rebuild when `eventCount > 20`; 3.5s bound |

New helper: `buildProjectionBundleFast()` in `projection-bundle.ts`.

New helper: `unwrapApiData()` in `projection-api-response.ts`.

Client fetch timeout increased to **5s** (`PROJECTION_FETCH_TIMEOUT_MS`).

---

## Stale trade display policy (unchanged, verified)

- OPEN + FLAT position → `CLOSED_PENDING_PNL` or `RECONCILIATION_REQUIRED`
- `effectiveOpenCount` excludes stale opens from active count
- Dashboard/trades use effective counts, not raw stale OPEN list

---

## Remaining warnings (production data)

- 7 closed trades missing `PNL_REALIZED` / `CLOSE_REVIEWED`
- Evidence 0/12 — rejected trades pending lifecycle repair
- `STALE_POSITION` for `trade-1781177426006-qic688`
- Core health `WARNING` — expected until journal repair

These are **data/journal issues**, not UI loading blockers.

---

## Build / test results

```
npm test       → 281/281 pass
npm run build  → pass
```

New tests: `src/lib/core/core-engine-hotfix2.test.ts` (11 tests)

---

## Final recommendation

| Status | When |
|--------|------|
| **CORE_ENGINE_PARTIAL** | Now — UI/API no longer timeout; lifecycle/PnL journal warnings remain |
| **CORE_ENGINE_STABLE** | After production verifies all core pages render + ui-consistency/projection-parity respond < 5s |

**Not CORE_ENGINE_NOT_READY** — no core page should remain permanently Loading after this hotfix.
