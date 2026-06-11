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

## Phase 7 — UI projection migration (Slice 7) ✅

| File | Status |
|------|--------|
| `src/lib/core/projection-client.ts` | ✅ Typed fetch helpers + zero-state |
| `src/lib/core/projection-bundle.ts` | ✅ Server bundle builder |
| `src/lib/core/ui-consistency-check.ts` | ✅ Cross-page parity |
| `src/lib/core/ui-context.ts` | ✅ Supplemental dashboard context |
| `src/components/use-projection-bundle.tsx` | ✅ Client hook |

APIs:
- `GET /api/core/projections/pnl`
- `GET /api/core/projections/risk`
- `GET /api/core/projections/bundle`
- `GET /api/core/ui-consistency`
- `GET /api/core/ui/context`

Pages migrated: `/`, `/trades`, `/ai-status`, `/reports`, `/settings`, `/operator`

Docs:
- [CORE_ENGINE_SLICE7_UI_PROJECTION_AUDIT.md](./CORE_ENGINE_SLICE7_UI_PROJECTION_AUDIT.md)
- [CORE_ENGINE_SLICE7_UI_PROJECTIONS.md](./CORE_ENGINE_SLICE7_UI_PROJECTIONS.md)

Legacy APIs retained for parity: `/api/mission/snapshot`, `/api/trades`, `/api/reports/summary`

## Phase 8 — Regression + STABLE documentation (Slice 8) ✅

- [CORE_ENGINE_STABLE_REPORT.md](./CORE_ENGINE_STABLE_REPORT.md) — full regression report
- [CORE_ENGINE_REGRESSION_FIX_LOG.md](./CORE_ENGINE_REGRESSION_FIX_LOG.md) — fix log
- `src/lib/core/api-regression.test.ts` — 12 API/core regression tests
- **Recommendation: `CORE_ENGINE_STABLE`**

## Phase 9 — Hot-path integration ✅

- [x] Wire `appendCoreEventStrict` in execute/close hot paths
- [x] Block execute when `evaluateCoreHealth().status === BLOCKED` (via guard chain)
- [x] Lifecycle strict-validation link fix (`decisionLogId`/`runId`)
- [x] Wire trace UI on AI Status
- [x] Resolve ESLint errors
- [ ] Projection vs legacy parity CI gate (post-STABLE)

## Phase 10 — Tests and audit ✅

- Full suite: **219/219 pass**
- `npm run build` — passes
- `npm run lint` — passes (0 errors)
- Production checklist: **10/10** @ Vercel

---

## Recommendation

**CORE_ENGINE_STABLE** (Slice 8 + integration follow-up)

219/219 tests pass, build/lint pass, production 10/10. UI reads projections; execute/close use strict core append; trace UI on AI Status. Post-STABLE: legacy API sunset, Reports briefing migration, parity CI gate.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-06 | Initial core engine layer (Phases 3–6) |
| 2026-06-06 | Slice 7: UI migration to projections (bundle, consistency, pages) |
| 2026-06-06 | Slice 8: Full regression + STABLE report |
| 2026-06-06 | STABLE follow-up: strict append, lifecycle fix, trace UI, lint, prod 10/10 |
