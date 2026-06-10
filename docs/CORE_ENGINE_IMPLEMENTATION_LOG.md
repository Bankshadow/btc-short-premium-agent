# Core Engine Implementation Log

Branch: **`v2-core`**  
Started: **2026-06-06**

---

## Phase 1 — Research ✅

- Created [CORE_ENGINE_RESEARCH_DISCOVERY.md](./CORE_ENGINE_RESEARCH_DISCOVERY.md)
- Reviewed 20+ repositories/patterns (Robson, NautilusTrader, Freqtrade, LangGraph, Temporal, SafeAgents, TrinityGuard, Marten/EventStoreDB patterns, etc.)
- Decision: **wrap-and-standardize**, no wholesale replacement, no new heavy dependencies

## Phase 2 — Design ✅

- Created [CORE_ENGINE_UPGRADE_DESIGN.md](./CORE_ENGINE_UPGRADE_DESIGN.md)

## Phase 3 — Event standardization ✅

| File | Status |
|------|--------|
| `src/lib/core/event-types.ts` | ✅ Extended metadata envelope |
| `src/lib/core/event-validator.ts` | ✅ Envelope, secrets, live leak, lifecycle |
| `src/lib/core/event-store.ts` | ✅ Adapter over journal append |
| `src/lib/core/event-bus.ts` | ✅ In-process pub/sub (optional) |
| `src/lib/core/core-errors.ts` | ✅ Typed errors |

**Backward compatibility:** Existing `appendEvent()` unchanged; `appendCoreEvent` / `appendCoreEventStrict` opt-in.

## Phase 4 — Projection engine ✅

| File | Status |
|------|--------|
| `src/lib/core/projection-engine.ts` | ✅ Registry + memoization |
| `src/lib/core/projections/*` | ✅ Mission, trades, positions, PnL, evidence, learning, risk, agents |
| `src/lib/evidence/evidence-progress.ts` | ✅ Added `buildEvidenceProgressFromEvents` (shared derive) |

APIs:
- `GET /api/core/projections/mission`
- `GET /api/core/projections/trades`
- `GET /api/core/projections/positions`
- `GET /api/core/projections/evidence`

## Phase 5 — Lifecycle trace ✅

| File | Status |
|------|--------|
| `src/lib/core/lifecycle-state-machine.ts` | ✅ Per-trade FSM |
| `src/lib/core/trace/trace-builder.ts` | ✅ Trace by link ID |
| `src/lib/core/event-replay.ts` | ✅ Replay projections |

APIs:
- `GET /api/core/trace/[id]`
- `POST /api/core/replay`

## Phase 6 — Core health ✅

| File | Status |
|------|--------|
| `src/lib/core/core-health.ts` | ✅ Aggregated health |
| `src/lib/core/core-engine.ts` | ✅ Facade |

APIs:
- `GET /api/core/health`
- `GET /api/core/events`
- `POST /api/core/events/validate`

Guards facade: `src/lib/core/guards/*` (wraps existing gates)

## Phase 7 — Integration cleanup ⏳ Partial

- [ ] Wire `appendCoreEventStrict` in execute/close hot paths
- [ ] Block execute when `evaluateCoreHealth().status === BLOCKED`
- [ ] Dashboard reads `/api/core/projections/mission` (optional fallback)

## Phase 8 — Tests and audit ✅ Partial

- `src/lib/core-engine.test.ts` — 16 tests
- Full suite: **164/164 pass**
- `npm run build` — pending verification each release

---

## Recommendation

**CORE_ENGINE_PARTIAL**

Core modules, validator, projection engine, lifecycle FSM, health/trace/replay APIs exist and tests pass. MVP 1–24 flows unchanged. Remaining work for **CORE_ENGINE_STABLE**: hot-path validated append, health gate on execute, UI trace section, deduplicated guard calls.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-06 | Initial core engine layer (Phases 3–6) |
