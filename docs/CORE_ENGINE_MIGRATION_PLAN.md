# Core Engine Migration Plan

Branch: **`v2-core`**  
Project: **btc-short-premium-agent**  
Date: **2026-06-06**

Related: [CORE_ENGINE_ADR.md](./CORE_ENGINE_ADR.md) · [CORE_ENGINE_BLUEPRINT.md](./CORE_ENGINE_BLUEPRINT.md)

**Principles:** adapter migration, not rewrite; no live trading; no new MVP features; no large dependencies; no external code copy. Execute/close hot paths unchanged until **Slice 7**.

**Prior spike note:** `src/lib/core/*` and `/api/core/*` may already exist from exploratory work. Each slice **formalizes** behavior per ADR/Blueprint rather than adding net-new product features. Slice 1 is the authoritative start for validation policy and naming (`event-store-adapter.ts`).

---

## Slice overview

| Slice | Focus | Execute/close touched? |
|-------|--------|------------------------|
| 1 | Event schema + validator + secret leakage | No |
| 2 | Lifecycle FSM + invalid transitions | No |
| 3 | Projection engine read-only + mission/trade | No |
| 4 | Position/PnL/Evidence projections | No |
| 5 | Trace builder + `/api/core/trace` | No |
| 6 | Core health + `/api/core/health` | No |
| 7 | Guard chain → execute/close | **Yes** |
| 8 | UI → shared projections | No (read path) |
| 9 | Regression + final audit | Verify only |

---

## Slice 1: Event schema + Event validator + Secret leakage validator

### Goal

Establish canonical core event types, validation rules (V-001–V-007), and secret/live-leak detection. Provide read-only and opt-in strict append paths without changing existing loop append behavior.

### Files to create/change

| Action | Path |
|--------|------|
| Create/rename | `src/lib/core/event-types.ts` |
| Create/rename | `src/lib/core/event-validator.ts` |
| Create/rename | `src/lib/core/event-store-adapter.ts` (rename from `event-store.ts` if present) |
| Create | `src/lib/core/core-errors.ts` |
| Create/update | `src/app/api/core/events/validate/route.ts` |
| Update | `docs/V2_EVENT_MODEL.md` — reference core metadata |
| Tests | `src/lib/core/event-validator.test.ts` |

### APIs affected

- **New/enhanced:** `POST /api/core/events/validate` — body: single event or batch; returns `{ valid, errors[], warnings[] }`
- **Unchanged:** all loop routes still call `appendEvent` directly (permissive mode)

### Tests required

- Valid minimal envelope passes
- Missing `type` / invalid `environment` fails
- Payload with `apiSecret`, `BINANCE_API_SECRET`, etc. fails (V-004)
- `redactSecrets` detects embedded secrets (V-005)
- `liveEnabled: true` in payload fails (V-006)
- `appendValidatedEvent` throws on ERROR when strict; legacy `appendEvent` unchanged
- Zero-state: validate empty batch → valid

### Acceptance criteria

- [ ] `event-types.ts` exports `CoreEventMetadata`, validation result types
- [ ] `event-validator.ts` implements V-001–V-007 with ERROR/WARNING severities
- [ ] `event-store-adapter.ts` exposes `appendValidatedEvent` (strict) and delegates persistence to `journal-query`
- [ ] No production loop module switched to strict append
- [ ] `POST /api/core/events/validate` returns 200 with structured errors
- [ ] All existing tests pass; new validator tests ≥ 15 cases
- [ ] No live trading enabled; `environment: live` rejected

### Rollback plan

- Revert adapter rename; keep direct `appendEvent` only
- Remove or disable `/api/core/events/validate` route
- Journal data unchanged — no data migration

---

## Slice 2: Lifecycle state machine + invalid transition detection

### Goal

Pure trade-scoped FSM over journal events; detect impossible transitions and missing prerequisites (V-008–V-011 on read; optional strict on append).

### Files to create/change

| Action | Path |
|--------|------|
| Create/update | `src/lib/core/lifecycle-state-machine.ts` |
| Update | `src/lib/core/event-validator.ts` — lifecycle rules for trade-scoped events |
| Tests | `src/lib/core/lifecycle-state-machine.test.ts` |

### APIs affected

- `POST /api/core/events/validate` — includes lifecycle errors when `tradeId` present
- **Unchanged:** execute, close, preview routes

### Tests required

- Full happy path: CREATED → … → EVIDENCE_VALIDATED
- `ORDER_EXECUTED` without `EXECUTION_REVIEWED` → INVALID/BLOCKED
- `PNL_REALIZED` without `POSITION_CLOSED` → error
- `EXECUTE_BLOCKED` → terminal BLOCKED state
- Multiple trades isolated by `tradeId`
- Zero-state: no events → no trade state

### Acceptance criteria

- [ ] `deriveLifecycleState(tradeId, events)` returns state + `invalidTransitions[]`
- [ ] Validator flags V-008–V-011 for strict mode
- [ ] Historical journals: read validation WARNING only (no retroactive append block)
- [ ] No changes to `execute-testnet-order.ts` or close modules
- [ ] `full-lifecycle-loop.test.ts` still passes

### Rollback plan

- Remove lifecycle checks from validator; keep FSM as read-only utility
- No journal mutations

---

## Slice 3: Projection engine read-only + mission/trade projections

### Goal

Central projection registry with memoization; mission and trade read models wrap existing builders (`buildMissionSnapshot`, trade-store builders).

### Files to create/change

| Action | Path |
|--------|------|
| Create/update | `src/lib/core/projection-engine.ts` |
| Create/update | `src/lib/core/projections/mission-projection.ts` |
| Create/update | `src/lib/core/projections/trade-projection.ts` |
| Create/update | `src/app/api/core/projections/mission/route.ts` |
| Create/update | `src/app/api/core/projections/trades/route.ts` |
| Tests | `src/lib/core/projection-engine.test.ts`, parity tests vs legacy |

### APIs affected

- **New/enhanced:** `GET /api/core/projections/mission`, `GET /api/core/projections/trades`
- **Unchanged:** `/api/mission/snapshot`, `/api/trades` (legacy still primary for UI)

### Tests required

- Zero-state mission: $1000 equity, 0 trades
- After mock lifecycle events, mission/trades match legacy `buildMissionSnapshot` / trade-store
- Cache invalidates when event count changes
- Projection failure returns zero-state + logs warning (no throw to API)

### Acceptance criteria

- [ ] `getProjection('mission' | 'trades')` returns typed read models
- [ ] Parity test: core mission JSON ≡ legacy snapshot (field subset)
- [ ] No writes to journal from projection layer
- [ ] UI still uses legacy APIs (Slice 8 deferred)

### Rollback plan

- Remove core projection routes; UI unaffected
- Delete projection cache module only

---

## Slice 4: Position/PnL/Evidence projections

### Goal

Complete read-model set: positions, PnL rollup, evidence progress, risk flags.

### Files to create/change

| Action | Path |
|--------|------|
| Create/update | `src/lib/core/projections/position-projection.ts` |
| Create/update | `src/lib/core/projections/pnl-projection.ts` |
| Create/update | `src/lib/core/projections/evidence-projection.ts` |
| Create/update | `src/lib/core/projections/risk-projection.ts` |
| Create/update | `src/app/api/core/projections/positions/route.ts` |
| Create/update | `src/app/api/core/projections/evidence/route.ts` |
| Optional | `POST /api/core/replay` — rebuild all projections + integrity report |

### APIs affected

- `GET /api/core/projections/positions`, `/evidence`
- Optional: `POST /api/core/replay`

### Tests required

- Position count matches `getLatestMonitoredSnapshots`
- PnL sum matches sum of `PNL_REALIZED` payloads
- Evidence 0/12 zero-state; full lifecycle → 12/12 valid (read-only derive)
- Risk projection reflects kill-switch / portfolio pause events

### Acceptance criteria

- [ ] All six projection IDs registered in engine
- [ ] `POST /api/core/replay` read-only; returns `{ projections, validation, lifecycleIssues }`
- [ ] Evidence uses `buildEvidenceProgressFromEvents` only — no re-append
- [ ] Legacy APIs unchanged for UI

### Rollback plan

- Disable new projection routes
- Projection engine optional — legacy derives remain source for UI

---

## Slice 5: Trace builder + `/api/core/trace`

### Goal

Unified trace by `runId`, `decisionLogId`, `tradeId`, `previewId`, or `positionId`; expose steps, lifecycle, gaps, recommendations.

### Files to create/change

| Action | Path |
|--------|------|
| Create/rename | `src/lib/core/trace-builder.ts` (from `trace/trace-builder.ts` if nested) |
| Create/update | `src/app/api/core/trace/[id]/route.ts` |
| Tests | `src/lib/core/trace-builder.test.ts` |

### APIs affected

- `GET /api/core/trace/[id]?type=tradeId|runId|…`

### Tests required

- Trace full lifecycle trade → ordered steps with phase labels
- Missing `PNL_REALIZED` listed in `missingExpectedEvents`
- Invalid transition surfaced when ORDER without review injected in test journal
- Query by `runId` returns all related events
- Read-only: no append side effects

### Acceptance criteria

- [ ] Trace response includes `liveLocked: true`
- [ ] Works with empty journal (empty steps, no crash)
- [ ] Optional AI Status badge can consume API (UI wiring optional)

### Rollback plan

- Remove trace route; no impact on trading paths

---

## Slice 6: Core health + `/api/core/health`

### Goal

Single aggregated health endpoint combining validator, projections, lifecycle, legacy engine health, exchange status, operator/kill-switch.

### Files to create/change

| Action | Path |
|--------|------|
| Create/update | `src/lib/core/core-health.ts` |
| Create/update | `src/app/api/core/health/route.ts` |
| Tests | `src/lib/core/core-health.test.ts` |

### APIs affected

- `GET /api/core/health`

### Tests required

- Empty journal → OK or WARNING, not BLOCKED (unless live flag)
- Corrupt chain → `eventJournalStatus: WARNING|BLOCKED`
- Projection build failure → `projectionStatus: WARNING`
- `liveLocked: true` always
- Does not trigger execute or close

### Acceptance criteria

- [ ] Response shape matches Blueprint §10
- [ ] Health check does not mutate journal
- [ ] Execute/close **not** blocked by health until Slice 7 (documented)

### Rollback plan

- Remove `/api/core/health` route
- Legacy `/api/health` unchanged

---

## Slice 7: Guard chain integration for execute and close

### Goal

Ordered guard chain before testnet execute and close; strict validated append for critical events; optional block when core health BLOCKED (execute/close only).

### Files to create/change

| Action | Path |
|--------|------|
| Create | `src/lib/core/guard-chain.ts` |
| Create/update | `src/lib/core/guards/*.ts` (8 guards — thin delegates) |
| Update | `src/lib/execution/execute-testnet-order.ts` — call guard chain first |
| Update | `src/lib/execution/close-testnet-position.ts` (or equivalent) — guard chain |
| Update | `src/lib/core/event-store-adapter.ts` — strict append for ORDER_EXECUTED, CLOSE_ORDER_EXECUTED, etc. |
| Tests | `src/lib/core/guard-chain.test.ts`, execution integration tests |

### APIs affected

- `POST /api/execution/execute` — same contract; internal guard order
- `POST /api/execution/close` — same contract
- Failed guard → existing blocked response + `EXECUTE_BLOCKED` / `CLOSE_BLOCKED` events

### Tests required

- Each guard failure stops chain; later guards not evaluated
- Live lock always blocks (even if other gates pass)
- Operator blocked → execute fails
- Reduce-only guard on close
- Strict append rejects invalid lifecycle append
- Full lifecycle E2E still passes with guards enabled

### Acceptance criteria

- [ ] No bypass of existing safety gates — guards delegate, not duplicate divergent logic
- [ ] `liveLocked` remains true; no live orders
- [ ] Guard failure emits journal block event (existing behavior preserved)
- [ ] ADR-005 fully implemented

### Rollback plan

- Revert execute/close to pre-guard-chain calls (single commit revert)
- Switch critical appends back to permissive `appendEvent`
- Journal entries from blocked attempts remain valid audit trail

---

## Slice 8: UI migration to shared projections

### Goal

Dashboard, Reports, Trades, AI Status read state via `/api/core/projections/*` or legacy routes that delegate to projection engine internally.

### Files to create/change

| Action | Path |
|--------|------|
| Update | Legacy API routes to delegate to `projection-engine` |
| Update | UI pages: `/`, `/trades`, `/reports`, `/ai-status` — fetch core projections |
| Remove | Duplicate client-side equity/evidence computation |

### APIs affected

- `/api/mission/snapshot`, `/api/trades`, etc. — implementation only; response shape unchanged (ADR Q3)

### Tests required

- API parity: legacy response ≡ core projection adapter
- UI smoke: pages render with empty journal and with test lifecycle
- No new client-side trading actions

### Acceptance criteria

- [ ] Single derive path for mission equity and open trades
- [ ] UI does not compute critical state locally
- [ ] No new features; read-path migration only

### Rollback plan

- UI reverts to legacy API URLs
- Legacy routes call original builders directly

---

## Slice 9: Regression test and final audit

### Goal

Full test suite green; safety audit; document `CORE_ENGINE_STABLE` vs `PARTIAL`.

### Files to create/change

| Action | Path |
|--------|------|
| Update | `docs/CORE_ENGINE_TEST_REPORT.md` |
| Update | `docs/V2_FINAL_SYSTEM_AUDIT.md` |
| Update | `docs/CORE_ENGINE_IMPLEMENTATION_LOG.md` |
| Tests | Expand `src/lib/core-engine.test.ts`; run `full-lifecycle-loop.test.ts` |

### APIs affected

- None new — verification only

### Tests required

- `npm test` — all pass (target ≥ 180 tests)
- `npm run build` — pass
- Manual checklist: preview → execute → monitor → close → PnL → post-trade loop
- Verify MiroFish/collaboration cannot import execute
- Verify no `environment: live` events in test fixtures used in CI

### Acceptance criteria

- [ ] All slices 1–8 acceptance criteria met
- [ ] `CORE_ENGINE_STABLE` documented or explicit remaining gaps listed
- [ ] No live trading; safety rules unchanged
- [ ] Migration log complete per slice

### Rollback plan

- N/A — audit slice; prior slice rollbacks apply per commit

---

## Cross-slice dependencies

```
Slice 1 ──► Slice 2 ──► Slice 3 ──► Slice 4
                              │
                    Slice 5 ◄─┘
                    Slice 6 ◄─┘
                              │
                    Slice 7 (requires 1,2,6)
                              │
                    Slice 8 (requires 3,4)
                              │
                    Slice 9 (requires all)
```

---

## Global rollback (any slice)

1. Git revert slice commit(s).
2. Journal file never migrated — data safe.
3. Disable `/api/core/*` routes via revert.
4. Execute/close: revert Slice 7 only for trading behavior restoration.

---

## Document status

Migration plan complete. Begin implementation at **Slice 1** only after explicit approval.
