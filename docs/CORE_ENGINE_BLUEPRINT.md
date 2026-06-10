# Core Engine Blueprint

Branch: **`v2-core`**  
Project: **btc-short-premium-agent**  
Date: **2026-06-06**

Related: [CORE_ENGINE_ADR.md](./CORE_ENGINE_ADR.md) · [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md) · [CORE_ENGINE_RESEARCH_DISCOVERY.md](./CORE_ENGINE_RESEARCH_DISCOVERY.md)

This document is the **target blueprint**. Implementation follows [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md) slice-by-slice. No live trading. No external code copy.

---

## 1. Current system map

```
┌──────────────────────────────────────────────────────────────────────────┐
│ UI: /  /trades  /ai-status  /reports  /settings  /operator              │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ 75+ API routes (legacy + optional /api/core/*)
┌───────────────────────────────▼──────────────────────────────────────────┐
│ Loop modules (behavior today)                                               │
│  analysis/          → runAnalysis, scenario-aware-analysis               │
│  execution/         → preview, safety, execute, close                    │
│  positions/         → monitor, reconcile                                   │
│  pnl/               → calculatePnlForTrade → post-trade-loop              │
│  learning/ evidence/ strategy/ agents/ operator/ portfolio-risk/ …       │
│  skills/mirofish-swarm/  collaboration/  (advisory)                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ appendEvent / getEvents (direct)
┌───────────────────────────────▼──────────────────────────────────────────┐
│ Event Journal — src/lib/journal/                                           │
│  journal-store.ts   event-journal.json (JOURNAL_DATA_DIR)                  │
│  journal-query.ts   appendEvent, getEvents                                 │
│  journal-chain-validator.ts  post-hoc warnings only                          │
└────────────────────────────────────────────────────────────────────────────┘

Derived today (independent full scans):
  mission/mission-snapshot.ts
  trades/trade-store.ts
  positions/position-monitor.ts
  evidence/evidence-progress.ts
  portfolio-risk/, health/, reports/build-reports-summary.ts
```

**Pain points:** no append validation, duplicate gate logic, fragmented health, UI may call different derive paths.

---

## 2. Target core engine map

```
┌──────────────────────────────────────────────────────────────────────────┐
│ UI (reads projections via API only — no critical state computation)       │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
        Legacy APIs ────────────┼──────────── Core APIs (read-mostly first)
        /api/mission/snapshot   │            /api/core/health
        /api/trades             │            /api/core/trace/[id]
        /api/execution/*        │            /api/core/projections/*
                                │            /api/core/events/validate
┌───────────────────────────────▼──────────────────────────────────────────┐
│ src/lib/core/  (facade — ADR-010 adapter layer)                            │
│                                                                              │
│  event-types.ts ──► event-validator.ts ──► event-store-adapter.ts           │
│         │                    │                      │                        │
│         │                    └── lifecycle-state-machine.ts                  │
│         │                                      append → journal (SSOT)       │
│         ▼                                                                    │
│  projection-engine.ts ◄── read journal                                         │
│         │                                                                    │
│         ├── projections/mission|trade|position|pnl|evidence|risk             │
│         │                                                                    │
│  trace-builder.ts ◄── lifecycle + journal                                    │
│  core-health.ts ◄── validator + projections + legacy health slices           │
│  guard-chain.ts ◄── guards/* (Slice 7 → execute/close only)                │
│  core-errors.ts                                                              │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────────────┐
│ Event Journal (unchanged SSOT) + existing MVP modules (unchanged until Slice 7)│
└────────────────────────────────────────────────────────────────────────────────┘
```

**Data flow (target):**

```
Command → Guard chain (Slice 7) → Validate (strict optional) → Append event
       → Invalidate projection cache → Projections → API → UI
```

---

## 3. Module boundaries

| Module | Owns | Must NOT own |
|--------|------|--------------|
| `journal/` | Persistence, envelope types, append/query | Business validation, UI views |
| `core/event-validator.ts` | Schema, secrets, lifecycle rules | Order placement |
| `core/event-store-adapter.ts` | Validated append wrapper | Duplicate storage |
| `core/lifecycle-state-machine.ts` | Trade state derivation | Binance calls |
| `core/projection-engine.ts` | Registry, cache, rebuild | Trading decisions |
| `core/projections/*` | Read models (wrap legacy builders) | New PnL formulas |
| `core/guard-chain.ts` | Ordered gate evaluation | Journal writes |
| `core/guards/*` | Thin delegate to existing gates | Duplicate rule logic |
| `core/trace-builder.ts` | Trace views | Execution |
| `core/core-health.ts` | Aggregate status | Auto-execute |
| `execution/` | Testnet orders (unchanged until Slice 7) | Mission equity UI math |
| `skills/mirofish-swarm/` | Advisory reports | Preview/execute |

**Dependency rule:** `core/` may import `journal/`, `mission/`, `trades/`, etc. `skills/`, `collaboration/`, `agents/` must **not** import `execution/execute-*`.

---

## 4. Event schema

### 4.1 Existing envelope (unchanged — `journal-types.ts`)

| Field | Required | Notes |
|-------|----------|-------|
| `eventId` | yes | `evt-*` |
| `type` | yes | `JournalEventType` (86 types) |
| `timestamp` | yes | ISO 8601 UTC |
| `environment` | yes | `testnet` \| `simulation` — never `live` |
| `runId` | optional | Analysis chain |
| `decisionLogId` | optional | Analysis → preview → execute |
| `previewId` | optional | Execute gate |
| `tradeId` | optional | Trade lifecycle |
| `positionId` | optional | Monitor/close |
| `closePreviewId` | optional | Close gate |
| `payload` | yes | Type-specific object |

### 4.2 Core metadata extension (optional, backward compatible)

Stored in `payload.__coreMeta`:

```typescript
interface CoreEventMetadata {
  createdBy?: "SYSTEM" | "USER" | "AGENT" | "EXCHANGE";
  correlationId?: string;   // default: runId
  causationId?: string;     // prior eventId
  schemaVersion?: number;   // default: 1
  safeToReplay?: boolean;   // default: true
  source?: string;          // module name e.g. "execution/execute-testnet-order"
  strategyVersion?: string;
}
```

Legacy events without `__coreMeta` validate with defaults.

---

## 5. Event validation rules

| Rule ID | Check | Severity | When |
|---------|-------|----------|------|
| V-001 | `type`, `environment`, `payload` present | ERROR | append (strict) |
| V-002 | `environment !== "live"` | ERROR | append |
| V-003 | `timestamp` valid ISO | ERROR | append |
| V-004 | Secret key names in payload (`apiSecret`, etc.) | ERROR | append |
| V-005 | Redactable secret values (`redactSecrets`) | ERROR | append |
| V-006 | `liveEnabled: true` in payload | ERROR | append |
| V-007 | Duplicate same type+tradeId+timestamp window | WARNING | append |
| V-008 | `ORDER_EXECUTED` requires prior allowed `EXECUTION_REVIEWED` | ERROR | append (trade) |
| V-009 | `POSITION_CLOSED` requires `CLOSE_ORDER_EXECUTED` | ERROR | append |
| V-010 | `PNL_REALIZED` requires `POSITION_CLOSED` | ERROR | append |
| V-011 | `LEARNING_RECORD_CREATED` requires `PNL_REALIZED` | ERROR | append |
| V-012 | Batch chain rules (`journal-chain-validator`) | WARNING/BLOCK | health/replay |

**Modes:**

- **Permissive (default today):** direct `appendEvent` — unchanged until Slice 7.
- **Strict:** `appendValidatedEvent` throws on ERROR — opt-in per call site in Slice 7.
- **Read-only validate:** `POST /api/core/events/validate` — no append.

---

## 6. Lifecycle state machine

### States

```
CREATED → ANALYZED → PREVIEWED → SAFETY_REVIEWED → EXECUTED → POSITION_OPEN
  → MONITORED → CLOSE_PREVIEWED → CLOSE_REVIEWED → CLOSE_EXECUTED
  → POSITION_CLOSED → PNL_REALIZED → LEARNING_CREATED → EVIDENCE_VALIDATED

Terminal/alternate: INVALID | BLOCKED
```

### Event → state mapping (trade-scoped)

| Event | Advances state to |
|-------|-------------------|
| `VERDICT_CREATED` (same decisionLogId) | ANALYZED |
| `PREVIEW_CREATED` | PREVIEWED |
| `EXECUTION_REVIEWED` (allowed) | SAFETY_REVIEWED |
| `ORDER_EXECUTED` | EXECUTED (invalid if no review) |
| `POSITION_OPENED` | POSITION_OPEN |
| `POSITION_MONITORED` | MONITORED |
| `CLOSE_PREVIEW_CREATED` | CLOSE_PREVIEWED |
| `CLOSE_REVIEWED` | CLOSE_REVIEWED |
| `CLOSE_ORDER_EXECUTED` | CLOSE_EXECUTED |
| `POSITION_CLOSED` | POSITION_CLOSED |
| `PNL_REALIZED` | PNL_REALIZED |
| `LEARNING_RECORD_CREATED` | LEARNING_CREATED |
| `EVIDENCE_TRADE_VALIDATED` | EVIDENCE_VALIDATED |
| `EXECUTE_BLOCKED` / `CLOSE_BLOCKED` | BLOCKED |

Implementation: pure fold over events filtered by `tradeId` — see `lifecycle-state-machine.ts` (target).

---

## 7. Projection engine design

### Registry

```typescript
interface ProjectionDefinition<T> {
  id: ProjectionId;
  build: (events: JournalEvent[]) => T;
  zero: () => T;
}
```

### Registered projections (target)

| ID | Wraps | Zero-state |
|----|-------|------------|
| `mission` | `buildMissionSnapshot` | $1000 equity, 0 trades |
| `trades` | `buildOpenTradesFromEvents`, `buildClosedTradesFromEvents` | empty arrays |
| `positions` | `getLatestMonitoredSnapshots` + open count | 0 open |
| `pnl` | sum of `PNL_REALIZED` | 0 realized |
| `evidence` | `buildEvidenceProgressFromEvents` | 0/12 valid |
| `risk` | journal-derived kill/pause/portfolio flags | SAFE |

### Memoization

- Cache key: `{ eventCount, lastEventId }` from sorted journal head.
- Invalidate on any successful append via adapter.
- On build failure: return zero-state + `core-health` WARNING (never throw to UI).

### Replay

`POST /api/core/replay`: read journal → validate batch → rebuild all projections → return integrity report. **Does not mutate journal.**

---

## 8. Guard chain design

### Execute chain (Slice 7 — does not run until explicitly wired)

| Order | Guard | Source module |
|-------|-------|---------------|
| 1 | Operator | `operator-guard.ts` → `isOperatorBlocked` |
| 2 | Live lock | `live-lock-guard.ts` → `isLiveEnabled()` must be false |
| 3 | Engine health | `engine-health-guard.ts` → `isEngineExecutionBlocked` |
| 4 | Portfolio risk | `portfolio-risk-guard.ts` → `isPortfolioRiskBlocking` |
| 5 | No-trade rules | `no-trade-rule-guard.ts` → stale rule re-check (advisory) |
| 6 | Execution safety | `execution-safety-guard.ts` → `reviewExecutionSafety` |
| 7 | Exchange status | existing Binance testnet connected check |

### Close chain

| Order | Guard | Source module |
|-------|-------|---------------|
| 1–3 | Same as execute | operator, live-lock, engine-health |
| 4 | Reconciliation | `position-reconcile` — not BLOCKED |
| 5 | Close safety | `close-safety-guard.ts` |
| 6 | Reduce-only | `reduce-only-guard.ts` — preview.reduceOnly === true |
| 7 | Exchange status | testnet connected |

### Output

```typescript
interface GuardChainResult {
  allowed: boolean;
  blockers: Array<{ code: string; message: string; guard: string }>;
  liveLocked: true;
}
```

**Slice 1–6:** guard-chain.ts exists as spec + unit tests only; **execute/close keep current paths**.

---

## 9. Trace design

### Input

Any of: `runId`, `decisionLogId`, `tradeId`, `previewId`, `positionId`, `closePreviewId`

### Output (`TraceReport`)

| Field | Purpose |
|-------|---------|
| `steps[]` | Ordered events with phase label |
| `lifecycleState` | Current FSM state (if tradeId resolvable) |
| `missingExpectedEvents[]` | From lifecycle checklist |
| `invalidTransitions[]` | FSM BLOCK messages |
| `recommendation` | Operator next action (text only) |
| `liveLocked` | always true |

Read-only. No side effects.

---

## 10. Core health design

### Inputs

- Event batch validation (chain + lifecycle)
- Projection engine build success
- `runEngineHealthCheck()`
- `buildPortfolioRiskView()`
- `resolveTestnetConnectionStatus()`
- Operator/kill-switch hydration

### Output (`CoreHealthReport`)

| Field | Values |
|-------|--------|
| `status` | OK \| WARNING \| BLOCKED |
| `eventJournalStatus` | OK \| WARNING \| BLOCKED |
| `projectionStatus` | OK \| WARNING \| BLOCKED |
| `lifecycleStatus` | OK \| WARNING \| BLOCKED |
| `riskStatus` | SAFE \| DEFENSIVE \| BLOCKED |
| `exchangeStatus` | CONNECTED \| DISCONNECTED \| … |
| `operatorStatus` | summary string |
| `safetyStatus` | OK \| BLOCKED |
| `blockingIssues[]` | code, message, severity |
| `warnings[]` | code, message |
| `lastCheckedAt` | ISO timestamp |
| `liveLocked` | true |

**Zero-state:** empty journal → OK or WARNING only, never BLOCKED unless live flag enabled.

---

## 11. UI/API integration plan

| Phase | UI | API |
|-------|-----|-----|
| Slice 1–3 | No change | `POST /api/core/events/validate` only |
| Slice 4–5 | No change | `GET /api/core/projections/mission`, `trades` |
| Slice 5–6 | Optional badge on AI Status | `GET /api/core/trace/[id]`, `/api/core/health` |
| Slice 7 | No UX change (same buttons) | execute/close internally use guard-chain |
| Slice 8 | Dashboard, Reports, Trades read core projections | Legacy APIs delegate to projection engine |
| Slice 9 | Trace panel on AI Status / Reports | Parity tests legacy vs core |

**Rule:** UI never computes equity, evidence count, or open position state locally.

---

## 12. Migration plan

See [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md) for nine slices with acceptance criteria and rollback.

**Note:** Branch may contain exploratory `src/lib/core/*` from a prior spike. Migration formalizes naming (`event-store-adapter.ts`, `guard-chain.ts`), defers execute wiring to Slice 7, and treats Slice 1 as the authoritative start for strict validation policy.

---

## 13. Testing plan

| Layer | Tests |
|-------|-------|
| Event validator | valid/invalid envelope, secrets, live leak, strict append |
| Lifecycle FSM | full chain pass; ORDER without REVIEW fail; PnL without close fail |
| Projections | zero-state; after mock lifecycle; parity vs legacy APIs |
| Trace | by tradeId; missing events listed |
| Core health | zero-state OK; corrupt journal WARNING/BLOCKED |
| Guard chain | order enforced; each guard failure blocks (Slice 7) |
| Safety | MiroFish/collaboration no ORDER_EXECUTED; live locked |
| Regression | full `npm test` (164+); `full-lifecycle-loop.test.ts` |

---

## 14. Rollback plan (global)

1. Stop routing APIs to core projections — revert to legacy derive functions.
2. Remove strict append calls — direct `appendEvent` only.
3. Delete or ignore `src/lib/core/guard-chain.ts` wiring in execute/close.
4. Journal file untouched — no migration rollback needed for data.
5. Document rollback in git revert per slice commit.

---

## 15. Open questions

| # | Question | Owner | Default if unresolved |
|---|----------|-------|------------------------|
| Q1 | Strict append on all 86 event types or only trade-scoped critical types? | Core | Trade-scoped critical only in Slice 1 |
| Q2 | Lifecycle violations: block append or warn-only for historical journals? | Core | WARN on read; ERROR on strict append for new events only |
| Q3 | When legacy `/api/mission/snapshot` delegates to core, keep response shape identical? | API | Yes — adapter maps 1:1 |
| Q4 | Core health BLOCKED — block preview creation or only execute/close? | Safety | Execute/close only (Slice 7) |
| Q5 | Rename existing spike `event-store.ts` → `event-store-adapter.ts`? | Migration | Yes in Slice 1 |
| Q6 | Memoization invalidation across serverless instances? | Ops | Accept best-effort; journal length in cache key |
| Q7 | Evidence projection: use read-only derive without re-appending validation events? | Evidence | Yes — `buildEvidenceProgressFromEvents` only |

---

## Target file tree (canonical names)

```
src/lib/core/
  event-types.ts
  event-validator.ts
  event-store-adapter.ts      # wraps journal-query.appendEvent
  lifecycle-state-machine.ts
  projection-engine.ts
  guard-chain.ts              # Slice 7 behavior
  trace-builder.ts
  core-health.ts
  core-errors.ts
  loop-contracts.ts           # optional types mirror V2_LOOP_CONTRACTS
  projections/
    mission-projection.ts
    trade-projection.ts
    position-projection.ts
    pnl-projection.ts
    evidence-projection.ts
    risk-projection.ts
  guards/
    operator-guard.ts
    live-lock-guard.ts
    engine-health-guard.ts
    portfolio-risk-guard.ts
    no-trade-rule-guard.ts
    execution-safety-guard.ts
    close-safety-guard.ts
    reduce-only-guard.ts
```

**Document status:** Blueprint complete. Implementation per migration slices only.
