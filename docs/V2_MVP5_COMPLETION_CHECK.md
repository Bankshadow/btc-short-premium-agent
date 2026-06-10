# V2 MVP 5 Completion Check

**Branch:** `v2-core`  
**Checked:** 2026-06-06  
**Scope:** MVP 5A (Position Monitor + Reconciliation), MVP 5B (Close Preview + Safety Gate), MVP 5C (Reduce-only Close Execution)  
**MVP 6 status:** Not implemented (no `PNL_REALIZED` write path; closed trades use `CLOSED_PENDING_PNL`)

---

## Executive summary

| Item | Result |
|------|--------|
| **Overall MVP 5 status** | **COMPLETE** (5A + 5B + 5C) |
| **Recommendation** | **READY_FOR_MVP6** |
| **Tests** | 90/90 pass (`npm test`) |
| **Build** | Pass (`npm run build`) |
| **Live trading** | Locked |
| **Auto-close / force close** | Not present |

All required APIs, journal events, safety gates, and UI surfaces exist and behave as specified. Remaining gaps are **test coverage** and one **reconciliation freshness** nuance—not missing MVP 5 functionality.

---

## 1. Position Monitor (MVP 5A)

| Check | Result | Evidence |
|-------|--------|----------|
| `GET /api/positions/open` exists | **PASS** | `src/app/api/positions/open/route.ts` |
| `POST /api/positions/refresh` exists | **PASS** | `src/app/api/positions/refresh/route.ts` |
| `GET /api/positions/reconciliation` exists | **PASS** | `src/app/api/positions/reconciliation/route.ts` |
| OPEN trade refreshes into `PositionSnapshot` | **PASS** | `refreshOpenPositions()` in `src/lib/positions/position-monitor.ts` |
| `POSITION_MONITORED` event written | **PASS** | Appended per trade on refresh; test: `mvp5-position-close.test.ts` |
| Dashboard shows position snapshot | **PASS** | `src/app/page.tsx` — open position panel |
| Trades shows position snapshot | **PASS** | `src/app/trades/page.tsx` — `position` on open trades |
| AI Status shows latest `POSITION_MONITORED` | **PASS** | `src/app/ai-status/page.tsx` |
| Reports shows Position Monitor section | **PASS** | `src/app/reports/page.tsx` — open/monitored/closed counts |

### PositionSnapshot fields

| Field | Result | Notes |
|-------|--------|-------|
| `positionId` | **PASS** | `position-types.ts`, `buildSnapshotFromSources()` |
| `tradeId` | **PASS** | |
| `previewId` | **PASS** | |
| `runId` | **PASS** | |
| `decisionLogId` | **PASS** | |
| `environment = TESTNET` | **PASS** | Hard-coded in snapshot builder |
| `symbol` | **PASS** | |
| `side` | **PASS** | LONG / SHORT |
| `qty` | **PASS** | |
| `entryPrice` | **PASS** | |
| `markPrice` | **PASS** | |
| `notionalUsd` | **PASS** | Derived from mark × qty when available |
| `unrealizedPnl` | **PASS** | |
| `unrealizedPnlPct` | **PASS** | |
| `refreshedAt` | **PASS** | |
| `status` | **PASS** | OPEN / FLAT / UNKNOWN |

---

## 2. Reconciliation (MVP 5A)

| Check | Result | Evidence |
|-------|--------|----------|
| No open trades → clean zero-state | **PASS** | `refreshOpenPositions()` + test in `mvp5-position-close.test.ts` |
| Local OPEN missing Binance position → warning | **PASS** | `LOCAL_TRADE_MISSING_BINANCE_POSITION` in `position-reconcile.ts`; tested |
| Binance position missing local OPEN → warning | **PASS** | `BINANCE_POSITION_MISSING_LOCAL_TRADE`; tested |
| Qty mismatch → warning | **PASS** (code) | `QTY_MISMATCH` in `position-reconcile.ts` — **no dedicated unit test** |
| Side mismatch → warning | **PASS** (code) | `SIDE_MISMATCH` in `position-reconcile.ts` — **no dedicated unit test** |
| Multiple positions when `maxOpenPositions = 1` → blocker | **PASS** | `MAX_OPEN_POSITIONS_EXCEEDED` / `BINANCE_MAX_POSITIONS_EXCEEDED`; tested via 5B reconciliation BLOCKED test |
| Position UNKNOWN blocks close | **PASS** | `POSITION_STATE_UNKNOWN` severity BLOCKED; tests in 5B/5C |
| `POSITION_RECONCILIATION_WARNING` written on mismatch | **PASS** (code) | `position-monitor.ts` lines 310–324 — **no dedicated event assertion test** |

**Note:** `getReconciliationStatus()` recomputes from journal snapshots with `binancePositions: []`. Between refreshes, mismatch detection relies on last `POSITION_MONITORED` data plus connection/stale checks—not live Binance positions. Full mismatch detection runs on `POST /api/positions/refresh`.

---

## 3. Close Preview (MVP 5B)

| Check | Result | Evidence |
|-------|--------|----------|
| `POST /api/execution/testnet/close-preview` | **PASS** | `src/app/api/execution/testnet/close-preview/route.ts` |
| `POST /api/execution/testnet/close-review` | **PASS** | `src/app/api/execution/testnet/close-review/route.ts` |
| `GET /api/execution/testnet/close-preview/latest` | **PASS** | `src/app/api/execution/testnet/close-preview/latest/route.ts` |
| Requires OPEN trade | **PASS** | `create-close-preview.ts`; tests 5B/5 |
| Requires `PositionSnapshot.status = OPEN` | **PASS** | `ACTIVE_POSITION_REQUIRED` blocker |
| Requires `tradeId` | **PASS** | `MISSING_TRADE_ID` |
| Requires `decisionLogId` | **PASS** | `MISSING_DECISION_LOG_ID` |
| Requires `positionId` | **PASS** | Always set (`snapshot.positionId` or fallback `pos-{tradeId}`); safety gate validates non-empty |
| Expires after 15 minutes | **PASS** | `CLOSE_PREVIEW_TTL_MS = 15 * 60 * 1000` |
| `reduceOnly = true` | **PASS** | Hard-coded; tested |
| `requiresDoubleConfirm = true` | **PASS** | Type + creation |
| LONG → `sideToClose = SELL` | **PASS** | `closeSideForPosition()`; test 5B |
| SHORT → `sideToClose = BUY` | **PASS** | test 5B |
| `CLOSE_PREVIEW_CREATED` event | **PASS** | test 5B |
| `CLOSE_PREVIEW_BLOCKED` event | **PASS** | test 5B |

---

## 4. Close Safety Gate (MVP 5B)

Close blocked when:

| Condition | Result | Evidence |
|-----------|--------|----------|
| `doubleConfirm = false` | **PASS** | `close-safety-gate.ts`; tests 5B/5C |
| `closePreviewId` missing | **PASS** | `MISSING_CLOSE_PREVIEW_ID` |
| `tradeId` missing | **PASS** | `MISSING_TRADE_ID` |
| `decisionLogId` missing | **PASS** | `MISSING_DECISION_LOG_ID` |
| `positionId` missing | **PASS** | `MISSING_POSITION_ID` — **no isolated unit test** |
| Close preview expired | **PASS** | tests 5B/5C |
| Binance not CONNECTED | **PASS** | tests 5/5C |
| Live environment requested | **PASS** | `LIVE_ENVIRONMENT_BLOCKED`; tests 5B/5C |
| Kill switch active | **PASS** (code) | `KILL_SWITCH_ACTIVE` in gate + preview — **no MVP5 kill-switch test** |
| Position UNKNOWN | **PASS** | tests 5B/5C |
| Reconciliation BLOCKED | **PASS** | test 5B |
| `reduceOnly` not true | **PASS** | tests 5C |

Events:

| Event | Result |
|-------|--------|
| `CLOSE_REVIEWED` | **PASS** — test 5B |
| `CLOSE_BLOCKED` | **PASS** — test 5B (blocked review) |
| `DOUBLE_CONFIRM_REQUIRED` | **PASS** — test 5B |

---

## 5. Reduce-only Close Execution (MVP 5C)

| Check | Result | Evidence |
|-------|--------|----------|
| `POST /api/execution/testnet/close` | **PASS** | `src/app/api/execution/testnet/close/route.ts` |
| Loads ClosePreview | **PASS** | `execute-testnet-close.ts` |
| Validates ACTIVE preview | **PASS** | `CLOSE_PREVIEW_NOT_ACTIVE` |
| Runs CloseSafetyGate | **PASS** | `validateCloseExecution()` |
| Blocks if gate not allowed | **PASS** | no order sent; test 5C |
| Blocks if `reduceOnly` false | **PASS** | test 5C |
| Sends MARKET reduce-only to Testnet only | **PASS** | `createBinanceTestnetClient()` + `reduceOnly: true`; `isLiveEnabled()` guard |
| Never sends live order | **PASS** | live blocked at gate + execute entry |
| Cannot reverse / opposite position | **PASS** | reduce-only order only; no open-side logic |
| `CLOSE_ORDER_EXECUTED` on success | **PASS** | test 5C |
| Refreshes Binance position after close | **PASS** | `refreshOpenPositions()` after order |
| `POSITION_CLOSED` when flat | **PASS** | test 5C |
| Partial close → OPEN + `POSITION_MONITORED` | **PASS** | test 5C |
| `MISSION_SNAPSHOT_UPDATED` | **PASS** | test 5C |
| `ERROR_RECORDED` on Binance failure | **PASS** | catch block in `execute-testnet-close.ts` |

---

## 6. UI Consistency

| Surface | Result | Evidence |
|---------|--------|----------|
| Dashboard — open position before close | **PASS** | `src/app/page.tsx` |
| Dashboard — no open / closed pending PnL after close | **PASS** | `latestClosedTrade` panel |
| Trades — OPEN before close | **PASS** | open trades list |
| Trades — CLOSED / CLOSED_PENDING_PNL after close | **PASS** | `trade-store.ts` + trades UI |
| AI Status — monitor / close events | **PASS** | `POSITION_MONITORED`, `CLOSE_ORDER_EXECUTED`, `POSITION_CLOSED`, etc. |
| Reports — open / monitored / preview / closed / reconciliation | **PASS** | `build-reports-summary.ts` + reports page |
| Settings — Binance status consistent | **PASS** | `/api/binance/status` + `BinanceTestnetDiagnosticsPanel` on Settings |

---

## 7. Safety

| Check | Result |
|-------|--------|
| Live trading locked | **PASS** — `RISK_POLICY.liveLocked`, `isLiveEnabled()` guards |
| No force close | **PASS** — no matches in codebase |
| No auto-close | **PASS** — no matches in codebase |
| No browser-side secret exposure | **PASS** — client uses `/api/binance/status` diagnostics only |
| API responses omit apiKey / apiSecret / signature | **PASS** — `apiKeyPresent` / `apiSecretPresent` booleans only; tests in 4/5/5C |
| Close requires `doubleConfirm = true` | **PASS** — API route rejects `!== true` |
| Close requires `reduceOnly = true` | **PASS** |
| Close blocked if Binance not CONNECTED | **PASS** |

---

## 8. Tests run

**Command:** `npm test`  
**Result:** **90/90 pass** (12 suites)

| Test file | MVP | Relevant coverage |
|-----------|-----|-------------------|
| `src/lib/mvp5-position-close.test.ts` | 5A/5C | zero-state, refresh, reconciliation warnings, close blockers, successful close |
| `src/lib/mvp5b-close-preview.test.ts` | 5B | preview creation, sides, safety gate, events, no order when blocked |
| `src/lib/mvp5c-close-execute.test.ts` | 5C | execute blockers, reduceOnly, flat/partial close, secrets |
| `src/lib/mvp46-zero-state.test.ts` | 4.6 | mission/reports zero-state, live locked |
| `src/lib/mvp4-execute.test.ts` | 4 | testnet execute, live blocked, secrets |

**Command:** `npm run build`  
**Result:** **PASS** (Next.js 16.2.7, TypeScript clean)

### Required test matrix (checklist item 8)

| Test | Status |
|------|--------|
| Zero-state no open trades | **PASS** — `mvp5-position-close.test.ts` |
| Refresh position success | **PASS** — `POSITION_MONITORED` test |
| Reconciliation mismatch | **PARTIAL** — local/Binance missing tested; qty/side mismatch code-only |
| Close preview requires OPEN trade | **PASS** — 5B + 5 |
| Close preview reduceOnly true | **PASS** |
| Close review blocks without doubleConfirm | **PASS** — 5B |
| Close blocks when position UNKNOWN | **PASS** — 5B/5C |
| Close blocks when Binance disconnected | **PASS** — 5/5C |
| Close blocks when reduceOnly false | **PASS** — 5/5C |
| Successful close writes CLOSE_ORDER_EXECUTED | **PASS** — 5/5C |
| Flat position writes POSITION_CLOSED | **PASS** — 5C |
| Live trading remains locked | **PASS** — 5/5C/4.6 |
| No secrets returned | **PASS** — 4/5/5C |

### Missing tests (documented, non-blocking)

1. `QTY_MISMATCH` reconciliation issue generation  
2. `SIDE_MISMATCH` reconciliation issue generation  
3. `POSITION_RECONCILIATION_WARNING` journal event assertion after refresh  
4. Kill switch blocks close preview / close review / close execute (MVP 5 path)  
5. Isolated `MISSING_POSITION_ID` safety gate case  

---

## Files inspected

### APIs
- `src/app/api/positions/open/route.ts`
- `src/app/api/positions/refresh/route.ts`
- `src/app/api/positions/reconciliation/route.ts`
- `src/app/api/execution/testnet/close-preview/route.ts`
- `src/app/api/execution/testnet/close-preview/latest/route.ts`
- `src/app/api/execution/testnet/close-review/route.ts`
- `src/app/api/execution/testnet/close/route.ts`
- `src/app/api/binance/status/route.ts`
- `src/app/api/trades/route.ts`
- `src/app/api/mission/snapshot/route.ts`
- `src/app/api/reports/summary/route.ts`

### Core modules
- `src/lib/positions/position-types.ts`
- `src/lib/positions/position-monitor.ts`
- `src/lib/positions/position-reconcile.ts`
- `src/lib/execution/close-preview-types.ts`
- `src/lib/execution/create-close-preview.ts`
- `src/lib/execution/close-safety-gate.ts`
- `src/lib/execution/close-preview-store.ts`
- `src/lib/execution/execute-testnet-close.ts`
- `src/lib/trades/trade-store.ts`
- `src/lib/trades/trade-types.ts`
- `src/lib/journal/journal-types.ts`
- `src/lib/risk/risk-gate.ts`

### UI
- `src/app/page.tsx` (Dashboard)
- `src/app/trades/page.tsx`
- `src/app/ai-status/page.tsx`
- `src/app/reports/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/CloseReviewModal.tsx`

### Tests
- `src/lib/mvp5-position-close.test.ts`
- `src/lib/mvp5b-close-preview.test.ts`
- `src/lib/mvp5c-close-execute.test.ts`

### Docs (reference)
- `docs/V2_LOOP_CONTRACTS.md`
- `docs/V2_MVP_EXIT_CRITERIA.md`

---

## Risks before MVP 6

| Risk | Severity | Mitigation for MVP 6 |
|------|----------|----------------------|
| Closed trades show `CLOSED_PENDING_PNL` with `netPnl = 0` until `PNL_REALIZED` | Expected | Implement MVP 6 PnL loop; write `PNL_REALIZED` + update mission equity |
| Reconciliation between refreshes uses journal snapshots, not live Binance book | Low | Refresh before close; consider passing cached Binance positions into `getReconciliationStatus()` in a future hardening pass |
| Kill switch / qty-side mismatch paths lack automated MVP5 tests | Low | Add tests when touching MVP 6 (optional hardening) |
| `positionId` fallback at preview creation if snapshot missing | Low | Refresh positions before close preview (UI flow already encourages this) |
| Partial close leaves OPEN trade with reduced qty | By design | MVP 6 should attribute PnL only on full close or define partial PnL rules |

---

## MVP 6 readiness confirmation

| Item | Status |
|------|--------|
| MVP 6 Realized PnL implemented | **NO** — correct |
| `PNL_REALIZED` write path | **Not present** |
| Live trading enabled | **NO** |
| Auto-close / force close | **Not present** |

---

## Recommendation

### **READY_FOR_MVP6**

MVP 5A, 5B, and 5C are fully implemented on `v2-core`. The position monitor → close preview → safety gate → reduce-only close loop is complete, testnet-only, and safe. Build and all 90 tests pass.

Proceed to **MVP 6: Realized PnL + Closed Trade Result** to populate `PNL_REALIZED`, finalize `CLOSED` trade rows, and update mission equity from closed testnet trades.
