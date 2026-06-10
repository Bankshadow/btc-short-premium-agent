# Core Engine Slice 2 — Lifecycle State Machine

Branch: **`v2-core`**  
Date: **2026-06-06**

Related: [CORE_ENGINE_SLICE1_EVENT_STANDARDIZATION.md](./CORE_ENGINE_SLICE1_EVENT_STANDARDIZATION.md) · [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md)

Slice 2 formalizes the **trade-scoped lifecycle FSM** with impossible-transition detection. **No execute/close hot path changes.** Loops still use permissive `appendEvent()`.

---

## States

```
CREATED → ANALYZED → PREVIEWED → SAFETY_REVIEWED → EXECUTED → POSITION_OPEN
  → MONITORED → CLOSE_PREVIEWED → CLOSE_REVIEWED → CLOSE_EXECUTED
  → POSITION_CLOSED → PNL_REALIZED → LEARNING_CREATED → EVIDENCE_VALIDATED

Terminal/alternate: INVALID | BLOCKED
```

Implementation: `src/lib/core/lifecycle-state-machine.ts`

---

## API

| Function | Purpose |
|----------|---------|
| `deriveLifecycleState(tradeId, events)` | Primary FSM derive (alias) |
| `deriveTradeLifecycleState(tradeId, events)` | Same as above (legacy name) |
| `validateLifecycleTransition(event, existing, { mode })` | Single-event gate (V-008–V-011) |
| `validateLifecycleForCoreEvent(coreEvent, existing, { mode })` | CoreEvent adapter |
| `validateAllTradeLifecycles(events, { mode })` | Batch scan all tradeIds |

### Snapshot shape

```typescript
{
  tradeId: string;
  state: TradeLifecycleState;
  issues: LifecycleTransitionIssue[];
  invalidTransitions: InvalidTransition[];  // BLOCK issues with from/to state
  lastEventType: string | null;
  lastEventAt: string | null;
  eventCount: number;
}
```

---

## Validation rules (V-008–V-011)

| Rule | Event | Requirement | Strict append | Historical read |
|------|-------|-------------|---------------|-----------------|
| V-008 | `ORDER_EXECUTED` | Prior allowed `EXECUTION_REVIEWED` (same preview) | ERROR | WARNING |
| V-009 | `POSITION_CLOSED` | Prior `CLOSE_ORDER_EXECUTED` | ERROR | WARNING |
| V-010 | `PNL_REALIZED` | Prior `POSITION_CLOSED` | ERROR | WARNING |
| V-011 | `LEARNING_RECORD_CREATED` | Prior `PNL_REALIZED` for trade | ERROR | WARNING |

**Mode:**

- `read` — batch/health/replay; BLOCK → WARNING (no retroactive journal block)
- `strict` — `validateBeforeAppend` / `validateCoreEvent` with `existingEvents`

---

## Validator integration

- `validateCoreEvent(event, { existingEvents, checkLifecycle: true })` — strict lifecycle errors
- `POST /api/core/events/validate` — reads journal, returns `lifecycleState` + `invalidTransitions`
- `validateEventBatch` — uses `mode: "read"` for historical scans
- `validateBeforeAppend` — uses `validateLifecycleTransition(..., { mode: "strict" })`

---

## Tests

`src/lib/core/lifecycle-state-machine.test.ts` — 9 cases:

- Zero trade events → CREATED
- Full happy path → EVIDENCE_VALIDATED
- ORDER without review → INVALID
- PnL without close → INVALID
- EXECUTE_BLOCKED → BLOCKED
- Multi-trade isolation
- Strict vs read mode severity

Full suite: **191 tests passing**

---

## Next slice (per your roadmap)

**Slice 3 — Projection Engine** (mission/trade/position/pnl/evidence/risk read models)

```
Implement Core Engine Slice 3: Projection Engine.

Read:
- docs/CORE_ENGINE_MIGRATION_PLAN.md (Slice 3–4)
- docs/CORE_ENGINE_BLUEPRINT.md (section 7)
- src/lib/core/projection-engine.ts

Goals:
1. Formalize projection registry + memoization
2. Wrap existing builders (mission, trades, positions, pnl, evidence, risk)
3. GET /api/core/projections/* parity with legacy APIs
4. Read-only — no journal writes
5. Do NOT change execute/close or UI yet
6. Add projection-engine.test.ts
```

---

## Slice 2 status

| Criterion | Status |
|-----------|--------|
| `deriveLifecycleState` + `invalidTransitions[]` | ✅ |
| V-008–V-011 in validator (strict/read modes) | ✅ |
| Historical journals WARN only on read | ✅ |
| No execute/close changes | ✅ |
| `full-lifecycle-loop.test.ts` passes | ✅ |
