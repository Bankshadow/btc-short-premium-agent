# V2 Architecture

Branch: **`v2-core`**

This document defines the clean v2 architecture. Future implementation must follow these boundaries so v2 does not inherit v1 feature-sprawl.

Related docs:

- [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md) — journal schema and event types
- [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md) — non-negotiable trading safety rules
- [V2_ROADMAP.md](./V2_ROADMAP.md) — sprint plan (Sprint 0–1 complete)
- [BRANCH_STRATEGY.md](./BRANCH_STRATEGY.md) — `main` (v1 reference) vs `v2-core` (active)

---

## V2 goal

Build a **minimal, stable, auditable testnet operating loop** for AI-assisted trading practice.

v2 exists to prove one thing first: a complete, safe, journal-backed cycle from analysis → preview → double-confirmed execute → monitor → reduce-only close → PnL → learning → mission progress.

Everything else waits until that loop is reliable.

**Mission framing:** grow simulated equity from **$1,000 → $10,000** on testnet evidence, with every step traceable in the Event Journal.

---

## What v2 will build first

Only the core modules required for the operating loop:

| Module | Path (planned) | Responsibility |
|--------|----------------|----------------|
| **Event Journal** | `src/lib/journal/` | Append events, query events, derive all durable state |
| **Mission Snapshot** | `src/lib/mission/` | `startCapital`, `targetCapital`, `currentEquity`, `progressPct`, PnL, trade counts, win/loss — **derived from journal** |
| **Analysis Run** | `src/lib/analysis/` | Create `runId`, `decisionLogId`, produce verdict (`WAIT` \| `TRADE` \| `BLOCKED`) with reasons and confidence |
| **Risk Gate** | `src/lib/risk/` | Testnet enabled, live locked, duplicate order guard, kill switch, preview expiry, double confirm, `decisionLogId` required |
| **Testnet Preview / Execute** | `src/lib/execution/` | Binance testnet status, create preview, execute with double confirm, close reduce-only — **no live execution** |
| **Trades** | `src/lib/trades/` | Open trades, closed trades, realized/unrealized PnL, trade result — **derived from journal** |
| **Learning** | `src/lib/learning/` | Create learning record after closed trade; link `tradeId` + `decisionLogId` |
| **Reports** | `src/lib/reports/` | Daily summary, evidence progress (0/12), readiness zero-state — **derived from journal** |

### Pages (thin UI, API-only)

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — mission, AI state, open position, next action, risk/testnet status |
| `/trades` | Open/closed trades, PnL, linked `decisionLogId` |
| `/ai-status` | Latest `runId`, `decisionLogId`, recent events, blockers |
| `/reports` | Evidence progress, daily summary, learning count, readiness |
| `/settings` | Testnet config status, live locked, risk limits, kill switch |

### APIs (read/write boundary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mission/snapshot` | Mission + AI + risk derived view |
| POST | `/api/analysis/run` | Start AI cycle |
| GET | `/api/analysis/latest` | Latest verdict |
| GET | `/api/journal/events` | Query journal |
| GET | `/api/trades` | Trades view |
| POST | `/api/execution/preview` | Create testnet preview |
| POST | `/api/execution/testnet/execute` | Execute (double confirm) |
| POST | `/api/execution/testnet/close` | Close reduce-only |
| GET | `/api/binance/status` | Testnet connectivity |
| GET | `/api/reports/summary` | Reports view |

### Core flow (target)

```
Start AI
  → create runId + decisionLogId
  → ANALYSIS_STARTED
  → produce verdict
  → VERDICT_CREATED
  → if TRADE: PREVIEW_CREATED
  → user double-confirms
  → ORDER_EXECUTED (+ POSITION_OPENED)
  → monitor / refresh
  → close reduce-only
  → POSITION_CLOSED
  → PNL_REALIZED
  → LEARNING_CREATED
  → mission snapshot derived (optional MISSION_SNAPSHOT_UPDATED audit event)
```

---

## What v2 will not build yet

Do **not** add these until the core loop above is stable and audited:

- Live trading or live pilot flows
- Auto-execution without operator double confirmation
- Regime brain, strategist, adaptation, agent-os, advanced modules
- Reconciliation backfill, evidence-quality subsystems, orphan-MVP rules
- Streaming SSE dashboards, multi-tab mission state, browser-side secrets
- Live evidence collection, live pilot, risk-budget live modes
- Admin panels, job runners, cron automation beyond minimal testnet loop
- Duplicate parallel state stores (mission DB, trade cache, UI-only trade lists)
- Force execute, bypass gates, or “temporary” safety overrides
- New pages beyond the five listed above
- ML/learning automation beyond post-close record creation

If a feature existed in v1 and is not listed in **What v2 will build first**, it is **out of scope for v2-core** until explicitly promoted after core stability review.

---

## Module boundaries

Each module owns one concern. Cross-module rules:

```
┌─────────────────────────────────────────────────────────┐
│                     Event Journal                        │
│              (append + query + derive)                   │
│                   SINGLE SOURCE OF TRUTH                 │
└──────────────────────────┬──────────────────────────────┘
                           │ derive / read
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
 Mission              Trades               Reports
 Snapshot              View                 Summary
     ▲                     ▲
     │ write events        │
 Analysis ──► Risk Gate ──► Execution (testnet only)
     │              │
     └──── Learning ◄────── (after POSITION_CLOSED + PNL_REALIZED)
```

| Rule | Detail |
|------|--------|
| **Journal owns history** | No module writes durable trade/mission state outside the journal (except ephemeral runtime flags like kill-switch file, env config) |
| **Mission does not trade** | Mission builds read models only |
| **Analysis does not execute** | Analysis produces verdict + IDs; execution is a separate step after risk gate |
| **Risk gate is mandatory** | Execution module calls risk gate; gate cannot be skipped by UI |
| **Execution is testnet-only** | No code path to live exchange in v2-core |
| **UI calls APIs only** | Pages never import journal store or execution clients directly |
| **Learning is post-close** | Learning records are created only after a closed, PnL-realized trade |

**Allowed dependencies (downstream may import upstream):**

- `journal` ← nothing in domain layer (foundation)
- `mission`, `trades`, `reports` ← `journal`
- `analysis` ← `journal`, `risk` (read checks)
- `execution` ← `journal`, `risk`
- `learning` ← `journal`
- `app/api/*` ← domain modules
- `app/*` pages ← `fetch('/api/...')` only

**Forbidden:**

- UI → `execution` or `journal` direct imports
- `mission` → `execution`
- Any module → live exchange client
- Circular imports between domain modules

---

## Source of truth rule

1. The **Event Journal** is the only authoritative record of what happened.
2. Mission progress, open/closed trades, PnL totals, learning counts, and AI history are **derived** by replaying journal events — never stored as competing primary state.
3. If UI and journal disagree, **journal wins**. Fix the derivation or missing event; do not patch UI state.
4. Every trade lifecycle step must produce auditable events (see [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md)).
5. `runId` and `decisionLogId` link analysis → preview → execute → close → learning for a single decision chain.

---

## UI thin-layer rule

1. Pages are **read-mostly views** over HTTP APIs.
2. No page maintains its own copy of mission metrics, trade lists, or AI verdict state beyond transient form/modal UI.
3. Loading states must **resolve** — show data, empty state, or error with retry. No permanent spinners.
4. Execute/close actions go through API routes; modals collect double confirmation only.
5. Secrets (API keys) exist in server env only — never in client bundles or browser storage.

---

## Trading safety rule

All trading safety constraints are defined in [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md). Architecture summary:

- Live trading **locked**
- Testnet **only**
- Execute requires **double confirmation** and passing risk gate
- Close is **reduce-only**
- Execute **disabled when blocked**

Safety is enforced in `src/lib/risk/` and `src/lib/execution/` on the server. UI reflects gate results but does not enforce safety alone.

---

## Migration rule from v1

v1 on branch **`main`** is **reference only**. v2-core is a clean rebuild, not a refactor-in-place.

| Do | Don't |
|----|-------|
| Read v1 for domain lessons (blockers, testnet flow, evidence target) | Copy v1 `src/` wholesale into v2 |
| Extract **patterns** (double confirm modal, journal append) as fresh minimal code | Port v1 advanced modules “temporarily” |
| Map v1 concepts to v2 module boundaries in docs | Carry v1 parallel state (mission snapshot builders, orphan rules, reconcile) |
| Keep v1 docs/scripts on `main` for historical reference | Delete v1 from `main` |
| Align new events with [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md) | Reuse v1 event type names if semantics differ |

**Promotion checklist** (before importing anything from v1):

1. Does it serve the core loop in **What v2 will build first**?
2. Can it be journal-backed without duplicate state?
3. Does it pass all rules in [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md)?
4. Can it ship without adding a new page or advanced subsystem?

If any answer is **no**, defer until core loop stability review.

---

## Stability definition (exit criteria for “core loop stable”)

v2-core loop is considered stable when:

- [ ] Start AI creates `runId` + `decisionLogId` and journal events
- [ ] Preview links to `decisionLogId`
- [ ] Execute blocked without double confirm or disconnected testnet
- [ ] Close is reduce-only and produces PnL + learning events
- [ ] Dashboard, Trades, AI Status, Reports show consistent derived state
- [ ] Build passes; no permanent loading states
- [ ] No UI-only trading state

Only after this checklist passes should v2 consider the next feature tranche.

---

## Core Engine layer (2026-06-06)

v2-core adds an **adapter-first core engine** under `src/lib/core/` without replacing the Event Journal or MVP modules.

| Doc | Purpose |
|-----|---------|
| [CORE_ENGINE_RESEARCH_DISCOVERY.md](./CORE_ENGINE_RESEARCH_DISCOVERY.md) | Phase 1 research |
| [CORE_ENGINE_UPGRADE_DESIGN.md](./CORE_ENGINE_UPGRADE_DESIGN.md) | Target architecture |
| [CORE_ENGINE_IMPLEMENTATION_LOG.md](./CORE_ENGINE_IMPLEMENTATION_LOG.md) | Implementation status |
| [CORE_ENGINE_TEST_REPORT.md](./CORE_ENGINE_TEST_REPORT.md) | Test results |

New APIs: `GET /api/core/health`, `POST /api/core/replay`, `GET /api/core/trace/[id]`, `GET /api/core/projections/*`.

**Status:** `CORE_ENGINE_PARTIAL` — modules exist; hot-path migration and UI trace pending.
