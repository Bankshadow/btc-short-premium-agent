# Core Engine Regression Fix Log — Slice 8

Branch: **`v2-core`**  
Date: **2026-06-06**

---

## Summary

Slice 8 regression found **no P0 safety bugs**. Follow-up integration work closed remaining STABLE gaps: strict core append on execute/close hot paths, lifecycle strict-validation fix, AI Status trace UI, ESLint errors. **219/219 tests pass**, build and lint pass, production checklist **10/10**.

---

## Files Changed

| File | Reason | Priority |
|------|--------|----------|
| `src/lib/execution/execute-testnet-order.ts` | Wire `appendCoreEventStrict` on execute hot-path events | P1 |
| `src/lib/execution/execute-testnet-close.ts` | Wire `appendCoreEventStrict` on close hot-path events | P1 |
| `src/lib/core/lifecycle-state-machine.ts` | Fix strict append simulation — include `decisionLogId`/`runId` for linked review | P1 |
| `src/lib/core/event-validator.ts` | Pass `decisionLogId`/`runId` into lifecycle transition validation | P1 |
| `src/lib/core/lifecycle-state-machine.test.ts` | Test ORDER_EXECUTED strict path with linked EXECUTION_REVIEWED | P1 |
| `src/app/ai-status/page.tsx` | Lifecycle trace panel via `/api/core/trace/[id]` | P2 |
| `src/components/use-api.tsx` | Optional `enabled` flag; async fetch in effect (lint fix) | P3 |
| `src/lib/journal/journal-persistence.ts` | Rename `useBlobPersistence` → `isBlobJournalEnabled` (lint fix) | P3 |
| `src/lib/core/api-regression.test.ts` | Slice 8 API/core regression tests | P3 |
| `package.json` | Added `api-regression.test.ts` to test script | P3 |
| `docs/CORE_ENGINE_STABLE_REPORT.md` | STABLE readiness report | P3 |
| `docs/CORE_ENGINE_REGRESSION_FIX_LOG.md` | This log | P3 |
| `docs/CORE_ENGINE_IMPLEMENTATION_LOG.md` | Updated status | P3 |

---

## Regression Run Results

| Command | Result |
|---------|--------|
| `npm run build` | ✅ PASS |
| `npm test` | ✅ PASS — **219/219** |
| `npm run lint` | ✅ PASS — 0 errors, 2 warnings (config/worker only) |
| Production checklist | ✅ **10/10** @ Vercel |
| `npm run test` | ❌ Not defined |
| `npm run typecheck` | ❌ Not defined (TS via build) |

---

## Issues Investigated — No Fix Required

| Priority | Issue checked | Outcome |
|----------|---------------|---------|
| P0 | Live order possible | ✅ Blocked — `isLiveEnabled()` false, guard chain, tests pass |
| P0 | Secret exposure | ✅ Not found — redaction + validator tests pass |
| P0 | Safety gate bypass | ✅ Not found — `runExecuteGuardChain` wired |
| P0 | Close gate bypass | ✅ Not found — `runCloseGuardChain` wired |
| P0 | reduceOnly missing | ✅ Not found — close tests enforce true |
| P0 | UI computes critical state | ✅ Not found — Slice 7 static guards pass |
| P1 | Missing runId / decisionLogId | ✅ Tests pass |
| P1 | Projections wrong | ✅ Parity tests pass |
| P1 | Trace broken | ✅ `buildCoreTrace` passes |
| P1 | Core health wrong | ✅ Zero-state OK |
| P1 | Dashboard/reports mismatch | ✅ UI consistency OK |
| P2 | Permanent loading | ✅ Zero-state fallback in hook |
| P2 | API throws on zero-state | ✅ Not observed |

---

## Test Result After Changes

```
ℹ tests 219
ℹ suites 24
ℹ pass 219
ℹ fail 0
```

New suite `Slice 8 — core API regression`: **12/12 pass**

---

## Remaining Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Reports briefing/audit legacy API | Low | Primary stats from projections; legacy labeled |
| Legacy API sunset | Low | `/api/mission/snapshot`, `/api/trades` retained for parity |
| Blob journal on Vercel | Medium (ops) | Requires correct env; fixed in prior slices |

---

## Recommendation Carried Forward

**`CORE_ENGINE_STABLE`** — see [CORE_ENGINE_STABLE_REPORT.md](./CORE_ENGINE_STABLE_REPORT.md) §14.
