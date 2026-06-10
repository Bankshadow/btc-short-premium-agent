# Core Engine Research & Discovery

Branch: **`v2-core`**  
Project: **btc-short-premium-agent**  
Date: **2026-06-06**  
Phase: **1 — Research only (no runtime code changes in this phase)**

---

## 1. Research summary

This document captures a structured discovery pass across event-driven architecture, workflow/state-machine patterns, crypto trading systems, risk engines, agent orchestration, replay/audit systems, and safety-first autonomous agent patterns. The goal is to **upgrade the existing v2 journal-first system** into a reliable **AI Trading Operating System core** without replacing MVP 1–24 wholesale, without enabling live trading, and without introducing heavy dependencies unless clearly justified.

### Key findings

| Theme | Finding | Implication for this project |
|-------|---------|------------------------------|
| Event sourcing | Append-only logs + derived projections are the industry pattern for auditable trading | **Keep** `event-journal.json` as SSOT; add validators and projection registry, not a second store |
| State machines | Explicit lifecycle FSMs catch impossible transitions at write time | Add **trade lifecycle FSM** validated on append (adapter layer) |
| Workflow engines | Temporal/LangGraph excel at long-running durable workflows | **Do not adopt** as dependency; borrow **loop contracts** and **durable step chaining** conceptually |
| Trading bots | Most OSS bots mix strategy + execution + risk in one process | **Separate** advisory (agents) from execution (guarded testnet path) — already aligned with v2 |
| Risk engines | Portfolio limits, kill switch, cooldown, reconciliation blocks are standard | **Consolidate** scattered gate logic into `core/guards/` facade |
| Agent safety | Tool-use guardrails and advisory-only boundaries are mandatory | **Harden** MiroFish/collaboration boundary tests |
| Replay/audit | Per-run event logs + trace by correlation ID | Extend existing session replay + chain validator into **trace API** |
| Dependencies | EventStoreDB, Temporal, Kafka add ops burden | **Avoid** for MVP; file journal + in-process bus is sufficient for single-node testnet |

### Current v2 baseline (post-MVP 24)

The codebase already implements a working journal-backed loop with **148 passing tests** and **86 event types**. Gaps are architectural cohesion, not missing features:

- No central append pipeline with validation
- ~15 independent projection functions (derive-on-read, full journal scan)
- Implicit lifecycle ordering (replay array + post-hoc chain validator)
- Fragmented health across engine, portfolio, operator, production modules
- In-memory operator/portfolio state alongside journal (serverless drift risk)

**Recommendation:** Wrap and standardize — do not rewrite working modules.

---

## 2. Repositories reviewed

### 2.1 Event sourcing / audit log

| Repo | URL | License | Purpose |
|------|-----|---------|---------|
| **Robson** | https://github.com/ldamasio/robson | Check repo | Execution + risk engine with event-sourced state, query lifecycle (`Accepted → RiskChecked → Acting → Completed/Denied`), kill switch, panic close |
| **awesome-cqrs-event-sourcing** | https://github.com/leandrocp/awesome-cqrs-event-sourcing | — | Curated list: EventStoreDB, Marten, Equinox, Propulsion |
| **eventstoredb-event-sourcing** | https://github.com/evgeniy-khist/eventstoredb-event-sourcing | Check repo | CQRS + EventStoreDB tutorial patterns, snapshots, projections |
| **Marten** (docs) | https://martendb.io/events/learning.html | Apache 2.0 | Postgres event store + inline/async projections |
| **EventStoreDB / KurrentDB** | https://www.kurrent.io | Check product | Purpose-built event store, stream subscriptions |

**Architecture pattern:** Append-only event log → aggregate fold → projections for read models. Corrections are compensating events, not edits.

**Relevant concepts:** Stream per aggregate (tradeId), optimistic concurrency, snapshotting for long streams, CQRS read/write separation.

**Borrow conceptually:** Validation at append, projection registry, replay-from-offset, integrity verification binary.

**Do not copy:** Separate EventStoreDB deployment, .NET stack, Rust execution engine wholesale.

**Risks/mismatches:** Our journal is JSON file on disk for single-operator testnet — EventStoreDB is overkill until multi-node or high throughput.

---

### 2.2 Workflow engines / state machines

| Repo | URL | License | Purpose |
|------|-----|---------|---------|
| **LangGraph** | https://github.com/langchain-ai/langgraph | MIT | Stateful agent graphs, conditional edges, cyclical flows |
| **Temporal** | https://github.com/temporalio/temporal | MIT | Durable execution, retries, timers, workflow-as-code |
| **langgraph-temporal** | https://github.com/pradithya/langgraph-temporal | Check repo | LangGraph brain + Temporal muscle integration |
| **XState** | https://github.com/statelyai/xstate | MIT | JS/TS finite state machines and statecharts |

**Architecture pattern:** Explicit states + transitions; side effects in guarded actions; replay requires deterministic workflow code (Temporal) or event log (LangGraph checkpoints).

**Relevant concepts:** Loop contracts as graphs, impossible transition detection, human-in-the-loop as explicit states (maps to double confirm).

**Borrow conceptually:** Trade lifecycle as FSM; loop definitions as documented contracts (`V2_LOOP_CONTRACTS.md`); post-trade chain as sequential workflow with per-step error isolation (already in `post-trade-loop.ts`).

**Do not copy:** Running Temporal server, LangGraph as runtime dependency for trading loop, LLM-in-the-loop for execution decisions.

**Risks/mismatches:** Agent orchestration frameworks assume non-deterministic LLM steps — our execution path must remain deterministic and journal-backed.

---

### 2.3 AI agent orchestration

| Repo | URL | License | Purpose |
|------|-----|---------|---------|
| **Microsoft AutoGen** | https://github.com/microsoft/autogen | MIT | Multi-agent conversation frameworks |
| **SafeAgents / SafeAgentEval** | https://github.com/microsoft/SafeAgents | Check repo | Framework-agnostic safe MAS, ARIA/DHARMA evaluation |
| **TrinityGuard** | https://github.com/AI45Lab/TrinityGuard | Check repo | 20 MAS risk types, pre-deploy tests + runtime monitors |
| **OpenAI Agents SDK** | https://platform.openai.com/docs/guides/agents | — | Agent handoffs, tool use |

**Architecture pattern:** Agents produce structured outputs; orchestrator routes; **tools are gated**; safety evaluation is separate from execution.

**Relevant concepts:** Advisory-only agent layer, confidence calibration from outcomes, swarm votes that cannot call exchange APIs.

**Borrow conceptually:** Agent boundary tests (MiroFish cannot execute), structured JSON agent outputs, scoreboard from closed trade outcomes.

**Do not copy:** Autonomous tool execution, web browsing agents with shell access, benchmark harnesses as runtime dependencies.

**Risks/mismatches:** Our MiroFish swarm is already isolated — upgrade should add **formal guard tests**, not new agent frameworks.

---

### 2.4 Crypto trading bots

| Repo | URL | License | Purpose |
|------|-----|---------|---------|
| **NautilusTrader** | https://github.com/nautechsystems/nautilus_trader | LGPL-3.0 | Rust-native event-driven engine, backtest/live parity, message bus |
| **nautilus-event-store** | https://lib.rs/crates/nautilus-event-store | LGPL-3.0 | Per-run durable log at message bus boundary, verify + replay |
| **Freqtrade** | https://github.com/freqtrade/freqtrade | GPL-3.0 | Python crypto bot, backtesting, SQLite persistence |
| **Jesse** | https://github.com/jesse-ai/jesse | MIT | Algo trading framework, backtest focus |
| **Hummingbot** | https://github.com/hummingbot/hummingbot | Apache 2.0 | Market making, multi-exchange |

**Architecture pattern:** Event-driven message bus; strategy as consumer; execution adapter per venue; backtest uses same event semantics as live.

**Relevant concepts:** Research-to-live parity via shared event model; fill models; reconciliation worker; SSE event stream for ops (Robson also exposes `/events` SSE).

**Borrow conceptually:** Lifecycle state transitions on every order; reconciliation as first-class; **no strategy logic in execution module**.

**Do not copy:** Full trading engine replacement, GPL/LGPL dependencies in core, auto-trading cron loops.

**Risks/mismatches:** These bots assume autonomous signal generation — we require operator double confirm and verdict-gated preview.

---

### 2.5 Backtesting / portfolio engines

| Repo | URL | License | Purpose |
|------|-----|---------|---------|
| **mefai-autotrade** | https://github.com/mefai-dev/mefai-autotrade | Check repo | Large multi-strategy system, portfolio allocation, risk manager |
| **pyhedge** | https://github.com/FidesFiscus/pyhedge | Check repo | Multi-agent + quant, 7 pre-execution gates |
| **Astolfu/trading-bot** | https://github.com/Astolfu/trading-bot | MIT | Kill switch, circuit breaker, max drawdown |

**Architecture pattern:** Pre-execution gate stack; portfolio-level caps before order submission; Kelly/ATR sizing (advisory for us).

**Borrow conceptually:** Ordered guard chain; `SAFE / DEFENSIVE / BLOCKED` portfolio states; daily loss as calendar-day not cumulative.

**Do not copy:** Autonomous multi-strategy execution, genetic optimization loops, copy-trading hub.

---

### 2.6 Risk management engines

| Repo | URL | Purpose |
|------|-----|---------|
| **Robson** (see 2.1) | Monthly halt, panic, per-trade risk sizing |
| **Nexlify** | https://github.com/Bustaboy/Nexlify | Kill switch, flash crash, circuit breaker |
| **Internal v2** | `portfolio-risk-manager.ts`, `risk-gate.ts`, `operator-actions.ts` | Already implements daily loss, drawdown, cooldown, kill switch |

**Pattern:** Fail-closed gates ordered from operator → environment → health → portfolio → rules → execution.

**Borrow conceptually:** Single `evaluateGuards()` facade for execute vs close paths.

**Do not copy:** PIN-based emergency UI patterns without audit events; in-memory-only kill switch without journal hydration.

---

### 2.7 Multi-agent simulation (MiroFish-style)

| Pattern | Source | Notes |
|---------|--------|-------|
| Swarm scenario reports | Internal `mirofish-swarm/` | Advisory votes, no orders |
| Committee collaboration | Internal `collaboration/` | Proposals, critique, consensus — advisory |
| SafeAgents benchmarks | Microsoft | Evaluation methodology for agent harm |

**Borrow conceptually:** Scenario injection as read-only context; swarm agreement enum for rule engine; agent scoreboard from closed outcomes only.

**Do not copy:** Swarm-driven auto-execution; bullish swarm forcing TRADE (already blocked in `scenario-aware-analysis.ts`).

---

### 2.8 Dashboard / observability

| Pattern | Source | Notes |
|---------|--------|-------|
| OpenTelemetry traces | https://opentelemetry.io | Correlation IDs, span hierarchy — **conceptual only** |
| Robson SSE `/events` | Robson | Real-time ops stream |
| Internal session replay | `session-replay.ts` | Lifecycle-ordered steps per trade |
| Internal audit pack | `audit-pack-generator.ts` | Sectioned compliance export |

**Borrow conceptually:** Trace by `runId` / `tradeId`; core health dashboard; zero-state when projections fail.

**Do not copy:** Full OTel stack unless justified; second journal for UI sync (v1 anti-pattern).

---

### 2.9 Replay / session reconstruction

| Repo / pattern | Notes |
|----------------|-------|
| Nautilus event-store verify + replay | Per-run sealed log, integrity checks |
| Marten live aggregation | `AggregateStreamAsync` — replay events to state |
| Internal `validateJournalChain` | Post-hoc warnings, not append-time |
| Internal `createSessionReplay` | Ordered lifecycle steps |

**Borrow conceptually:** `POST /api/core/replay` rebuilds projections from journal; trace shows missing expected events.

---

### 2.10 Safety-first autonomous systems

| Repo | URL | Focus |
|------|-----|-------|
| **TrinityGuard** | https://github.com/AI45Lab/TrinityGuard | Pre-deploy + runtime MAS monitoring |
| **SafeAgents** | https://github.com/microsoft/SafeAgents | Attack detection, safety metrics |
| **Agent Action Guard** | https://action-guard.github.io/ | Tool-call screening before OS/API |

**Pattern:** Separate **planning/advisory** from **action execution**; screen actions at boundary; log all decisions.

**Apply here:** MiroFish → analysis only; execution APIs require guard chain + double confirm; agent modules have no import path to `executeTestnetOrder`.

---

## 3. Relevant architecture patterns

### A. Event-sourced core (primary fit)

```
Commands → Validate → Append Event → Projections → Read APIs → UI
```

- **SSOT:** Event Journal (existing)
- **Projections:** Mission, trades, positions, PnL, evidence, risk (existing functions → registry)
- **Replay:** Full journal scan → rebuild all projections (new capability)

### B. State machine trading lifecycle (high value)

Per-`tradeId` state derived from events:

```
CREATED → ANALYZED → PREVIEWED → SAFETY_REVIEWED → EXECUTED → POSITION_OPEN
  → MONITORED → CLOSE_PREVIEWED → CLOSE_REVIEWED → CLOSE_EXECUTED
  → POSITION_CLOSED → PNL_REALIZED → LEARNING_CREATED → EVIDENCE_VALIDATED
```

Invalid transitions flagged at validation time (adapter on append for critical types).

### C. Workflow / loop engine (medium value — docs + types)

Loops as **contracts** (already in `V2_LOOP_CONTRACTS.md`):

- Analysis, Preview, Execution Safety, Testnet Execute, Monitor, Close, PnL, Learning, Evidence, MiroFish, Collaboration, Audit

Implementation: imperative chains + post-trade loop — **no external workflow engine**.

### D. Risk engine (partial — consolidate)

Existing: daily loss, drawdown, max open positions, cooldown, kill switch, no-trade rules, reconciliation block.

Upgrade: unified guard ordering and `RiskState: SAFE | DEFENSIVE | BLOCKED`.

### E. Agent orchestration (boundary hardening)

Structured JSON outputs; advisory-only; no execution imports; confidence from closed trades.

### F. Observability and replay (extend existing)

Core health API, trace by link ID, audit pack, session replay — unify under `/api/core/*`.

---

## 4. Patterns worth adopting

1. **Append-time validation adapter** — wrap `appendEvent`, never replace store
2. **Projection engine registry** — single fold over events, memoize by journal length/hash
3. **Trade lifecycle FSM** — explicit states + impossible transition detection
4. **Guard chain facade** — one ordered evaluation for execute vs close
5. **Trace builder** — query by any link ID, return ordered chain + gaps
6. **Core health aggregation** — journal + projections + lifecycle + risk + operator
7. **Replay API** — rebuild projections, verify integrity (extends chain validator)
8. **Event metadata envelope** — `correlationId`, `causationId`, `createdBy`, `schemaVersion`, `safeToReplay`
9. **Loop contract types in code** — mirror `V2_LOOP_CONTRACTS.md` for tests
10. **MiroFish boundary tests** — assert no ORDER_EXECUTED from swarm/collaboration paths

---

## 5. Patterns to avoid

1. **Second event store** (v1 `engine-event-bus` anti-pattern)
2. **Temporal / Kafka / EventStoreDB** for current single-node testnet scope
3. **Autonomous auto-execute** from agents or cron
4. **UI-computed mission/trade state**
5. **Replacing journal with SQL/Redis primary store**
6. **Copying GPL/LGPL trading engines into core**
7. **LLM-in-the-loop for gate decisions**
8. **Full journal replay on every API call** without memoization
9. **Rewriting MVP modules** instead of adapter migration
10. **Live trading paths** “for testing”

---

## 6. Dependency recommendations

| Dependency | Recommendation | Rationale |
|------------|----------------|-----------|
| EventStoreDB / KurrentDB | **Reject** | Ops overhead; file journal sufficient |
| Temporal | **Reject** | Heavy; loops are short-lived HTTP requests |
| LangGraph | **Reject** | LLM orchestration not needed for execution core |
| XState | **Optional (dev-only)** | Could model FSM in TS without runtime dep — pure functions preferred |
| OpenTelemetry | **Defer** | Use correlation fields first; OTel later if multi-service |
| Zod / Valibot | **Optional** | Event schema validation at append — small, justified |
| Existing stack (Next.js, tsx tests) | **Keep** | 148 tests already green |

**Preferred approach:** Zero new production dependencies for Phase 3–6; pure TypeScript modules wrapping existing journal.

---

## 7. Core engine upgrade opportunities

| Opportunity | Priority | Effort | Impact |
|-------------|----------|--------|--------|
| Event validator on append (adapter) | P0 | M | Prevents corrupt journal |
| Lifecycle FSM + transition rules | P0 | M | Catches impossible chains |
| Projection engine + memoization | P1 | L | Performance + consistency |
| Core health API | P1 | S | Single ops surface |
| Trace API by link ID | P1 | M | Debugging + audit |
| Guard chain facade | P1 | M | Less duplication |
| Event metadata standardization | P2 | M | Future replay/OTel |
| Replay API | P2 | S | Recovery + tests |
| Block execute when core health BLOCKED | P2 | S | Safety |
| UI trace section | P3 | M | Operator visibility |

---

## 8. Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking MVP 1–24 flows during refactor | High | Adapter-only migration; full test suite after each phase |
| Serverless in-memory gate drift | Medium | Hydrate from journal before every gate (partially done) |
| Projection/journal divergence | Medium | Projections read-only; mission snapshot dual-write documented |
| Over-engineering with external workflow engine | Medium | Loop contracts in docs + types only |
| Secret leakage in event payloads | High | Secret leakage validator on append |
| Live order accidental enable | Critical | live-lock guard in core chain; tests |
| Performance regression (full journal scan) | Medium | Projection memoization by event count |
| License contamination from copied bot code | Medium | Conceptual borrow only; no code copy |

---

## 9. Final recommendation

**Proceed to Phase 2 (design)** with a **wrap-and-standardize** strategy:

1. Keep **Event Journal** as the only SSOT.
2. Add **`src/lib/core/`** as a facade layer — not a replacement.
3. Implement **append adapter**, **lifecycle FSM**, **projection registry**, **trace**, **core health** incrementally.
4. **Do not** enable live trading, **do not** add Temporal/Kafka/EventStoreDB.
5. Target acceptance: **`CORE_ENGINE_PARTIAL`** after Phases 3–6, **`CORE_ENGINE_STABLE`** after Phases 7–8 with full test coverage and UI integration.

**Research phase complete.** Runtime implementation begins only after `CORE_ENGINE_UPGRADE_DESIGN.md` is approved in Phase 2.

---

## Appendix: Research methodology

- GitHub Explore categories: event sourcing, trading bots, agent orchestration, risk management
- Cross-reference with existing v2 codebase audit (MVP 1–24, 148 tests)
- Pattern sources: Martin Fowler Event Sourcing, Azure Architecture Center, NautilusTrader docs, Marten docs
- Deliberately excluded: live trading automation repos, copy-trading, meme-coin bots, unlicensed scrapers

**Document status:** Phase 1 complete — ready for design phase.
