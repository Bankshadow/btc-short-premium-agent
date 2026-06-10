# Core Engine Test Report

Branch: **`v2-core`**  
Date: **2026-06-06**

---

## Summary

| Metric | Result |
|--------|--------|
| Total tests | **164** |
| Passed | **164** |
| Failed | **0** |
| New core engine tests | **16** |
| Build | ✅ Pass |

---

## Core engine test coverage (`src/lib/core-engine.test.ts`)

### Event system

| Test | Result |
|------|--------|
| Valid event envelope accepted | ✅ |
| Invalid event missing environment rejected | ✅ |
| Secret leakage rejected | ✅ |
| Live leakage detected | ✅ |
| Strict append rejects live environment | ✅ |

### Lifecycle

| Test | Result |
|------|--------|
| ORDER without safety review fails | ✅ |
| Valid full seed lifecycle passes | ✅ |
| PnL without POSITION_CLOSED fails | ✅ |
| Learning without PnL fails on append simulation | ✅ |

### Projection

| Test | Result |
|------|--------|
| Mission projection zero-state ($1000 equity) | ✅ |
| Replay rebuilds projections | ✅ |

### Safety

| Test | Result |
|------|--------|
| Live locked | ✅ |
| MiroFish cannot execute | ✅ |
| Collaboration cannot execute | ✅ |

### Trace / health

| Test | Result |
|------|--------|
| Core health OK on zero-state | ✅ |
| Trace by tradeId | ✅ |

---

## Regression (MVP 1–24)

All existing test files pass including:

- `full-lifecycle-loop.test.ts` — end-to-end checklist
- `v2-final-system-audit.test.ts` — system scenarios
- MVP 4/5/5B/5C execute/close suites

---

## Not yet automated (Phase 7–8)

- HTTP integration tests for `/api/core/*` routes
- Execute blocked when core health BLOCKED
- UI projection source parity across all pages
- Performance benchmark for projection memoization under large journals

---

## Final recommendation

**CORE_ENGINE_PARTIAL** — core layer tested in unit scope; integration and UI wiring pending for **CORE_ENGINE_STABLE**.
