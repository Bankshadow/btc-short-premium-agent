# Core Engine Architecture Decision Record (ADR)

Branch: **`v2-core`**  
Project: **btc-short-premium-agent**  
Date: **2026-06-06**  
Prerequisite: [CORE_ENGINE_RESEARCH_DISCOVERY.md](./CORE_ENGINE_RESEARCH_DISCOVERY.md)

Related: [CORE_ENGINE_BLUEPRINT.md](./CORE_ENGINE_BLUEPRINT.md) · [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md)

---

## Discovery classification (Step 1)

Findings from research and current v2 codebase review, classified for this project.

### Adopt — use as-is conceptually, implement in TypeScript adapters

| Finding | Why it fits | Safety | Dependency risk | Migration complexity | Benefit |
|---------|-------------|--------|-----------------|----------------------|---------|
| **Event Journal as SSOT** | MVP 1–24 already journal-backed; 86 event types, 164 tests | Critical — single audit trail | None — existing `journal-store.ts` | Low — no store replacement | Auditability, replay, operator trust |
| **Append-time validation** | Prevents corrupt chains before persistence | High — blocks secret/live leakage | None — pure TS | Medium — adapter on append | Fewer orphan events, safer journal |
| **Trade lifecycle FSM** | Maps 1:1 to testnet loop in `V2_LOOP_CONTRACTS.md` | High — catches ORDER without REVIEW | None | Medium — derive + validate | Impossible transitions visible early |
| **Projection registry** | ~15 derive-on-read functions today; unify not replace | Medium — UI reads server truth | None | Medium — wrap existing builders | Consistent equity/evidence across pages |
| **Guard chain ordering** | Scattered checks in execute/close/rules today | Critical — fail-closed execution | None — facade over existing gates | Medium — Slice 7 only | One mental model for ops |
| **Trace by link IDs** | `runId`, `decisionLogId`, `tradeId` already on envelope | Medium — debug/audit | None | Low–medium | Session reconstruction without UI guesswork |
| **Core health aggregation** | Engine + portfolio + operator + lifecycle fragmented | High — single BLOCKED surface | None | Low | Operator sees one status |
| **Loop contracts (docs + types)** | Already in `V2_LOOP_CONTRACTS.md` | Medium — prevents scope creep | None | Low | Testable loop boundaries |
| **MiroFish advisory-only boundary** | Already isolated; no execute imports | Critical | None | Low — tests only | Agents cannot place orders |
| **Post-trade sequential loop** | `post-trade-loop.ts` chains PnL → learning → evidence | Medium | None | Low — already done | Loop principle after close |
| **Secret redaction validator** | `redactSecrets` exists in security module | Critical | None | Low | No API keys in journal |
| **Kill switch / double confirm / reduceOnly** | `V2_SAFETY_RULES.md` enforced | Critical | None | Low — preserve behavior | Testnet-only safety |

### Adapt — borrow pattern, implement differently for v2 constraints

| Finding | Why adapt | Safety | Dependency risk | Migration complexity | Benefit |
|---------|-----------|--------|-----------------|----------------------|---------|
| **Event sourcing (Robson, Marten, Fowler)** | File journal not EventStoreDB; single operator | Positive if validated append added | Low | Medium | CQRS read models without new infra |
| **State machine (XState patterns)** | Pure functions preferred over XState runtime | Positive | Low if no XState dep | Medium | Explicit states without new package |
| **Workflow engine (Temporal/LangGraph concepts)** | HTTP request loops, not long-running workers | Neutral — avoid LLM in execute path | None if not imported | Low — docs/types only | Durable step chaining via journal events |
| **Nautilus message-bus / event-store** | In-process fan-out only; no Rust engine | Neutral | None | Low | Optional subscribers on append |
| **Robson query lifecycle** | Map to `EXECUTION_REVIEWED → ORDER_EXECUTED` | High | None | Medium | Clear denied vs completed semantics |
| **Portfolio gate stack (pyhedge, internal)** | Consolidate into `guard-chain.ts` facade | High | None | Medium (Slice 7) | Ordered fail-closed checks |
| **Session replay (internal)** | Extend to trace API + missing-event list | Medium | None | Low | Better than replay-only UI |
| **Event metadata envelope** | Optional `__coreMeta` on payload; backward compatible | Low | None | Low | Future OTel/correlation without breaking old events |
| **Evidence derive helper** | Shared `buildEvidenceProgressFromEvents` | Medium | None | Low | One evidence truth for APIs |
| **SafeAgents / TrinityGuard patterns** | Boundary tests only, not runtime monitors | High | None | Low | Prove MiroFish/collaboration cannot execute |
| **SSE ops stream (Robson)** | Defer; journal query sufficient for v2 | Neutral | None | Later | Real-time ops when needed |

### Avoid — do not implement for v2-core

| Finding | Why avoid | Safety impact if adopted | Dependency risk | Benefit lost (acceptable) |
|---------|-----------|--------------------------|-----------------|---------------------------|
| **EventStoreDB / KurrentDB** | Ops burden; single-node testnet | Neutral | High ops | Stream subscriptions — use file journal |
| **Temporal / Kafka workflow** | Loops are synchronous HTTP | Risk if auto-retry executes orders | High | Durable workers — journal is durable enough |
| **LangGraph as runtime** | LLM orchestration ≠ trading execute | Critical if agents trigger orders | Medium | Agent graphs — use existing analysis path |
| **Second event store (v1 engine-event-bus)** | Split SSOT caused drift | Critical | Medium | UI sync — use REST projections |
| **Full trading bot replacement (Freqtrade, Nautilus)** | GPL/LGPL; autonomous signals | Critical | License + behavior | Engine features — v2 loop is narrower |
| **Auto-execute / cron trading** | Violates `V2_SAFETY_RULES.md` | Critical | None | Convenience — operator must confirm |
| **UI-computed mission/trade state** | Violates architecture rules | Critical | None | — |
| **Live trading path “for testing”** | Explicitly locked | Critical | None | — |
| **Copy external repo code** | License + mismatch | Variable | Legal/tech debt | — |
| **LLM-in-the-loop gate decisions** | Non-deterministic safety | Critical | Medium | — |
| **Full journal replay every API call** | Performance | Neutral | None | Use memoized projections |

### Later — valid but deferred past core engine stable

| Finding | Why later | When to reconsider |
|---------|-----------|-------------------|
| **OpenTelemetry** | Correlation fields first | Multi-service or hosted agents |
| **Zod/Valibot schema registry** | Manual validator sufficient for Slice 1 | Event type count > 100 or external consumers |
| **Snapshotting per trade stream** | Journal size small today | >10k events or slow replay |
| **SSE `/events` stream** | Polling APIs adequate | Operator dashboard real-time need |
| **TrinityGuard runtime monitors** | Advisory boundary tests enough | Micro-live or external agent tools |
| **Backtesting engine integration** | Out of MVP 1–24 scope | Dedicated research sprint |
| **Async projection daemon** | Inline derive OK for testnet | High read load / multi-tenant |
| **Block execute on core health BLOCKED** | Designed in ADR; wired Slice 7 | After health API stable |

---

## ADR-001: Event Journal remains source of truth

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | v2 has 86 event types, working testnet loop, `data/event-journal.json` (or `JOURNAL_DATA_DIR`). Research shows event sourcing fits trading audit needs. v1 failed with parallel stores. |
| **Decision** | All durable state is derived from the Event Journal. No second authoritative store for mission, trades, positions, or PnL. Core engine adds validation and projections **on top of** `journal-query.appendEvent` / `getEvents`. |
| **Consequences** | (+) Single audit trail, replay possible. (−) Full-scan derive cost until memoization. Existing `MISSION_SNAPSHOT_UPDATED` dual-write remains as audit checkpoint, not SSOT. |
| **Alternatives considered** | EventStoreDB (rejected — ops); PostgreSQL primary (rejected — scope); Redis cache as SSOT (rejected — drift). |
| **Risks** | Journal file corruption; serverless multi-instance append races. |
| **Rollback plan** | Remove core adapter; modules continue direct `appendEvent`. Journal file unchanged. |

---

## ADR-002: Add Event Validator before Projection Engine

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | Today `appendEvent` has no schema/lifecycle/secret checks. `journal-chain-validator.ts` runs post-hoc only. |
| **Decision** | Introduce `event-validator.ts` that runs **before** append (strict mode) and **before** projection rebuild. Order: envelope → secrets → live leak → lifecycle (trade-scoped) → append. Projections consume already-persisted events; validator runs on read for health/replay. |
| **Consequences** | (+) Corrupt events blocked in strict path. (+) Health can report journal integrity. (−) Strict mode must be opt-in until Slice 7 to avoid breaking legacy append paths. |
| **Alternatives considered** | Validate only at API boundary (rejected — bypass via lib calls); DB constraints (N/A for JSON file). |
| **Risks** | False positives block legitimate events; performance on large journals during batch validate. |
| **Rollback plan** | Disable strict append; keep post-hoc `validateJournalChain` only. |

---

## ADR-003: Add Lifecycle State Machine for trade lifecycle

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | Lifecycle ordering is implicit (`session-replay.ts` array, evidence validator). Research (Robson, Nautilus) uses explicit states. |
| **Decision** | `lifecycle-state-machine.ts` derives per-`tradeId` state: `CREATED → … → EVIDENCE_VALIDATED | INVALID | BLOCKED`. Invalid transitions (e.g. `ORDER_EXECUTED` without `EXECUTION_REVIEWED`) produce BLOCK severity. Used by validator, trace, and core health — not UI computation. |
| **Consequences** | (+) Checklist alignment testable. (+) Trace shows gaps. (−) Analysis-only runs without `tradeId` use run-level events separately. |
| **Alternatives considered** | XState library (deferred — pure functions sufficient); validate only at close (rejected — too late). |
| **Risks** | Overly strict rules block historical journals with benign ordering quirks. |
| **Rollback plan** | Lifecycle checks downgrade to WARNING in validator; FSM module unused. |

---

## ADR-004: Add Projection Engine for Mission/Trade/Position/PnL/Evidence/Risk

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | `buildMissionSnapshot`, `trade-store`, `position-monitor`, `evidence-progress`, etc. each scan full journal independently. UI/API must show same equity and evidence counts. |
| **Decision** | `projection-engine.ts` registers projections that **wrap** existing builders. Memoize by `{ eventCount, lastEventId }`. Expose via `GET /api/core/projections/*`. Legacy `/api/mission/snapshot` remains until Slice 8 UI migration. |
| **Consequences** | (+) One fold, consistent read models. (+) Replay rebuilds all projections. (−) Must not duplicate business logic — adapters only. |
| **Alternatives considered** | Materialized DB tables (rejected — second store); rebuild every request without cache (rejected — performance). |
| **Risks** | Cache stale if append bypasses invalidation; projection bug diverges from legacy API. |
| **Rollback plan** | APIs route back to legacy derive functions; projection engine unused. |

---

## ADR-005: Add Guard Chain before execute and close

| Field | Value |
|-------|-------|
| **Status** | **Accepted** (implementation deferred to **Slice 7**) |
| **Context** | Gates live in `risk-gate`, `execution-safety-gate`, `close-safety-gate`, `operator-actions`, `portfolio-risk-manager`, `no-trade-rule-engine` with overlapping checks. |
| **Decision** | `guard-chain.ts` defines ordered evaluation. **Execute:** operator → live-lock → engine-health → portfolio-risk → no-trade (advisory re-check) → execution-safety → exchange status. **Close:** operator → live-lock → engine-health → reconciliation → close-safety → reduceOnly → exchange. Individual guards remain thin wrappers — no logic duplication. |
| **Consequences** | (+) Documented fail-closed order. (+) Core health aligns with execute blockers. (−) Slice 7 touches hot paths — requires full regression. |
| **Alternatives considered** | Single mega-function (rejected — untestable); middleware only at API (rejected — lib callers bypass). |
| **Risks** | Behavior change if order differs from today; missed guard in chain. |
| **Rollback plan** | Execute/close call existing gates directly; `guard-chain.ts` unused. |

---

## ADR-006: Add Trace Builder for runId/decisionLogId/tradeId

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | Operators need to follow one decision chain. `createSessionReplay` covers trade lifecycle steps only. |
| **Decision** | `trace-builder.ts` accepts any link ID, returns ordered events, lifecycle state, missing expected events, invalid transitions, recommendation. `GET /api/core/trace/[id]`. Read-only — no orders. |
| **Consequences** | (+) Debug/analysis without raw journal grep. (+) Complements audit pack. (−) Not a substitute for Binance order audit. |
| **Alternatives considered** | OpenTelemetry only (deferred); duplicate session replay (rejected — merge concepts). |
| **Risks** | Large journals slow trace for run with many events. |
| **Rollback plan** | Remove trace API; use `/api/journal/events` + session replay. |

---

## ADR-007: Add Core Health API

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | Health split across `/api/health/engine`, portfolio-risk, operator, production, security. |
| **Decision** | `GET /api/core/health` aggregates: journal integrity, projection build, lifecycle, risk (`SAFE|DEFENSIVE|BLOCKED`), exchange, operator, safety. Status `OK|WARNING|BLOCKED`. Blocking execute when BLOCKED is **Slice 7**, not Slice 6. |
| **Consequences** | (+) Single operator surface. (+) AI Status / Operator can show one badge. (−) Must not false-BLOCK on zero-state. |
| **Alternatives considered** | Extend only `/api/health/engine` (rejected — incomplete picture). |
| **Risks** | Over-blocking if lifecycle strict on empty journal. |
| **Rollback plan** | UI ignores core health; legacy health endpoints remain. |

---

## ADR-008: Keep MiroFish and multi-agent intelligence advisory-only

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | `mirofish-swarm`, `collaboration`, `agents` produce journal events but must not execute. Research (SafeAgents, TrinityGuard) emphasizes action boundaries. |
| **Decision** | No imports from `execution/execute-*` in skills/collaboration/agents. Swarm cannot create preview or call Binance. Agent scores update only after closed trades. Formal boundary tests in core test suite. |
| **Consequences** | (+) Safety invariant testable. (−) Agents cannot “self-heal” by closing positions — operator only. |
| **Alternatives considered** | Agent-driven preview (rejected — safety); tool-use guard library (deferred). |
| **Risks** | Future developer adds execute import — mitigated by grep test in Slice 9. |
| **Rollback plan** | N/A — non-negotiable per `V2_SAFETY_RULES.md`. |

---

## ADR-009: Avoid large external workflow dependency for now

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | Temporal, LangGraph, Kafka solve durable/long-running workflows. v2 loops complete in HTTP handlers with journal persistence. |
| **Decision** | **Reject** Temporal/Kafka/LangGraph as runtime dependencies for core engine. Loop contracts stay in docs + `loop-contracts.ts`. Post-trade chain stays imperative with per-step error isolation. |
| **Consequences** | (+) Zero ops overhead. (+) Deterministic execute path. (−) No built-in retry timers for multi-hour workflows (not required for testnet loop). |
| **Alternatives considered** | langgraph-temporal (rejected); Inngest/Trigger.dev (deferred). |
| **Risks** | Team assumes they need Temporal — document ADR clearly. |
| **Rollback plan** | N/A — dependency not added. |

---

## ADR-010: Use adapter migration instead of full rewrite

| Field | Value |
|-------|-------|
| **Status** | **Accepted** |
| **Context** | MVP 1–24 modules work; 164 tests pass. Research warns against wholesale replacement (Freqtrade, Nautilus, v1 sprawl). |
| **Decision** | Core engine is a **facade layer** under `src/lib/core/`. Wrap `appendEvent`, wrap `buildMissionSnapshot`, wrap gates. Nine migration slices with rollback per slice. No deletion of working modules until Slice 8–9 parity proven. Rename spike files to blueprint names during Slice 1 (e.g. `event-store-adapter.ts`). |
| **Consequences** | (+) Low regression risk per slice. (+) MVP flows unchanged until Slice 7. (−) Temporary duplication (legacy + core APIs). |
| **Alternatives considered** | Big-bang rewrite (rejected); fork new repo (rejected). |
| **Risks** | Half-migrated state confuses contributors — migration plan is source of truth. |
| **Rollback plan** | Per-slice rollback in [CORE_ENGINE_MIGRATION_PLAN.md](./CORE_ENGINE_MIGRATION_PLAN.md). |

---

## ADR index

| ID | Title | Status |
|----|-------|--------|
| ADR-001 | Event Journal remains SSOT | Accepted |
| ADR-002 | Event Validator before Projection Engine | Accepted |
| ADR-003 | Lifecycle State Machine | Accepted |
| ADR-004 | Projection Engine | Accepted |
| ADR-005 | Guard Chain | Accepted (Slice 7) |
| ADR-006 | Trace Builder | Accepted |
| ADR-007 | Core Health API | Accepted |
| ADR-008 | MiroFish advisory-only | Accepted |
| ADR-009 | No external workflow dependency | Accepted |
| ADR-010 | Adapter migration | Accepted |

**Document status:** Architecture decisions locked for migration. No runtime trading behavior changed by this document.
