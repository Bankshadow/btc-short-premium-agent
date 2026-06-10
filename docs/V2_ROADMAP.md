# V2 Roadmap

Branch: **`v2-core`**

Phased delivery plan for the clean v2 rebuild. Each sprint has explicit scope, exit criteria, and **out-of-scope** items to prevent v1 feature-sprawl.

Related docs:

- [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md)
- [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md)
- [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md)
- [BRANCH_STRATEGY.md](./BRANCH_STRATEGY.md)

---

## Principles (all sprints)

1. **Event Journal** is the single source of truth.
2. **UI is thin** — reads from APIs only.
3. **Live trading locked** — no live execution path on `v2-core`.
4. **Testnet only** when execution arrives (Sprint 2+).
5. **Double confirmation** required before any order (Sprint 2+).
6. Use v1 as **reference only** — do not copy wholesale.

---

## Sprint 0 — Foundation documentation

**Status:** Complete

### Deliverables

| Doc | Purpose |
|-----|---------|
| `V2_ARCHITECTURE.md` | Goals, module boundaries, migration rules |
| `V2_EVENT_MODEL.md` | Journal envelope, event types, derivation rules |
| `V2_SAFETY_RULES.md` | Non-negotiable trading safety |
| `V2_ROADMAP.md` | This file — phased plan |

### Exit criteria

- [x] Architecture doc defines what v2 builds first vs defers
- [x] Event model defines journal as SoT
- [x] Safety rules document live lock and no auto-execute
- [x] Branch strategy separates `main` (v1) from `v2-core` (active)

### Out of scope

- Application code
- Binance connectivity
- UI beyond placeholder pages

---

## Sprint 1 — Journal + Mission + Analysis mock

**Status:** Complete

### Modules

```
src/lib/journal/   journal-types, journal-store, journal-query
src/lib/mission/   mission-types, mission-snapshot
src/lib/analysis/  analysis-types, analysis-runner
src/lib/risk/      risk-types, risk-gate
```

### Journal API

- `appendEvent(event)`
- `getEvents()`
- `getEventsByRunId(runId)`
- `getEventsByDecisionLogId(decisionLogId)`

Storage: file-backed `data/event-journal.json` (configurable via `JOURNAL_DATA_DIR`).

### Mission snapshot (zero-state defaults)

| Field | Default |
|-------|---------|
| startCapital | 1000 |
| targetCapital | 10000 |
| currentEquity | 1000 |
| progressPct | 0 |
| totalTrades | 0 |
| win / loss | 0 / 0 |
| netPnl | 0 |
| openPositions | 0 |

Derived via `buildMissionSnapshot(events)` — never stored as competing primary state.

### Analysis run (`runAnalysis()`)

1. Create `runId` + `decisionLogId`
2. Append `ANALYSIS_STARTED`
3. Verdict: **`BLOCKED`** if testnet not configured (`BINANCE_TESTNET_ENABLED`), else **`WAIT`**
4. Append `VERDICT_CREATED`
5. Append `MISSION_SNAPSHOT_UPDATED`
6. Return `AnalysisResult`

No Binance calls. No previews. No orders.

### HTTP APIs

| Method | Path |
|--------|------|
| POST | `/api/analysis/run` |
| GET | `/api/analysis/latest` |
| GET | `/api/journal/events` |
| GET | `/api/mission/snapshot` |

### UI (minimal)

| Page | Data source |
|------|-------------|
| Dashboard | Start AI → `POST /api/analysis/run`; metrics → `GET /api/mission/snapshot` |
| AI Status | `GET /api/analysis/latest` + `GET /api/journal/events` |
| Reports | `GET /api/mission/snapshot` |

### Exit criteria

- [x] `npm run build` passes
- [x] `npm test` passes (mission zero-state, risk gate, analysis journal events)
- [x] Start AI creates `runId` and `decisionLogId`
- [x] Journal shows `ANALYSIS_STARTED`, `VERDICT_CREATED`, `MISSION_SNAPSHOT_UPDATED`
- [x] Dashboard updates latest decision from mission snapshot
- [x] AI Status shows latest run and events
- [x] No Binance order created
- [x] Live trading remains locked (`RISK_POLICY.liveLocked = true`)

### Out of scope

- Binance ping / order placement
- Preview / execute / close
- Trades, learning, reports modules (beyond snapshot-derived UI)
- Advanced v1 subsystems

---

## Sprint 2 — Risk hardening + Testnet preview (MVP 2)

**Status:** Complete

### Scope

- Preview module: `preview-types`, `preview-store`, `create-preview`
- Journal events: `PREVIEW_CREATED`, `PREVIEW_BLOCKED`
- APIs: `POST /api/execution/preview`, `GET /api/execution/preview/latest`, `GET /api/execution/preview/[previewId]`
- Analysis auto-creates preview on `TRADE` verdict (`V2_MVP2_MOCK_TRADE` or alternating cycles)
- Dashboard / AI Status / Reports show preview state
- **No Binance orders** — mock qty from static mark price

### Exit criteria

- [x] TRADE verdict creates `previewId`
- [x] Preview requires `runId` + `decisionLogId`
- [x] Preview TTL 15 minutes
- [x] Blocked preview writes `PREVIEW_BLOCKED`
- [x] Execute remains disabled
- [x] Live trading locked

---

## Sprint 3 — Execution safety gate (MVP 3)

**Status:** Complete

### Scope

- Execution safety module: `execution-safety-types`, `execution-safety-gate`, `duplicate-order-guard`, `preview-expiry`
- Journal events: `EXECUTION_REVIEWED`, `EXECUTE_BLOCKED`, `DOUBLE_CONFIRM_REQUIRED`, `PREVIEW_EXPIRED`, `DUPLICATE_ORDER_BLOCKED`, `KILL_SWITCH_BLOCKED`
- API: `POST /api/execution/review`, `GET /api/execution/review/latest`
- Dashboard execution review modal (gate only — no order placement)
- AI Status + Reports show execution safety state
- **No Binance orders** — safety gate only

### Exit criteria

- [x] Review API returns structured blockers
- [x] Missing double confirm blocks
- [x] Expired preview blocks
- [x] Duplicate order blocks
- [x] Unknown testnet status blocks (default disconnected)
- [x] Live trading remains locked
- [x] Every review writes `EXECUTION_REVIEWED`
- [x] Blocked reviews write `EXECUTE_BLOCKED`

---

## Sprint 4 — Testnet execute + close (planned)

**Status:** Not started

### Scope

- Double-confirm execute after safety gate pass
- `ORDER_EXECUTED`, `POSITION_OPENED`, `POSITION_CLOSED`, `PNL_REALIZED`
- Reduce-only close only
- Trades view from journal

### Exit criteria (draft)

- [ ] Full testnet cycle with journal audit trail
- [ ] Execute disabled when blocked
- [ ] Close disabled without double confirm

---

## Sprint 5 — Learning + Reports + Evidence (planned)

**Status:** Not started

### Scope

- `LEARNING_CREATED` after close
- Reports: evidence 0/12, daily summary, readiness zero-state
- Dashboard open position display

---

## Sprint 6 — Stability + hardening (planned)

**Status:** Not started

### Scope

- No permanent loading states audit
- Cross-page consistency checks
- Error journal events (`ERROR_RECORDED`)
- Production env templates (conservative defaults)

---

## v1 → v2 promotion rule

Before pulling any v1 code into a sprint:

1. Is it in the current sprint scope?
2. Can it be journal-backed without duplicate state?
3. Does it pass [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md)?
4. Does it avoid new pages/modules outside the sprint?

If any answer is **no**, defer.

---

## Current branch commands

```bash
git checkout v2-core
cp .env.example .env.local
npm install
npm test
npm run build
npm run dev
```

Set `BINANCE_TESTNET_ENABLED=true` in `.env.local` to get `WAIT` verdict instead of `BLOCKED` during Sprint 1 mock runs.
