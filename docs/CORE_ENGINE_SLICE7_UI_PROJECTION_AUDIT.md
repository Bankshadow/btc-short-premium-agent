# Core Engine Slice 7 — UI Projection Audit

Branch: **`v2-core`**  
Date: **2026-06-06**

## Purpose

Audit core UI pages for local computation of critical state vs server-side Core Projections. Slice 7 migrates critical reads to projection APIs while keeping legacy endpoints for supplemental and parity verification.

---

## Summary

| Area | Before Slice 7 | After Slice 7 |
|------|----------------|---------------|
| Critical metrics source | `/api/mission/snapshot`, `/api/trades`, `/api/reports/summary` | `/api/core/projections/bundle` + individual projection APIs |
| PnL / evidence / trade counts | Derived in legacy snapshot/summary builders | Read from projection engine |
| Binance status | Per-page `/api/binance/status` or embedded in snapshot | Shared `/api/binance/status` + bundle consistency check |
| Live lock | Client env inference on some pages | `risk.liveLocked` from projection (always `true` in MVP) |
| Loading behavior | Some pages blocked on legacy snapshot | Bundle + supplemental context; zero-state on error |

---

## Page / Component Audit

### `/` — Dashboard (`src/app/page.tsx`)

| Field | Previous source | Target projection | Migration status | Risks | Notes |
|-------|-----------------|-------------------|------------------|-------|-------|
| `currentEquity` | `/api/mission/snapshot` | `mission.currentEquity` | ✅ Migrated | Low | Via `useProjectionBundle()` |
| `targetEquity` | mission snapshot | `mission.targetCapital` | ✅ Migrated | Low | |
| `progressPct` | mission snapshot | `mission.progressPct` | ✅ Migrated | Low | |
| `netPnl` | mission snapshot | `pnl.totalNetPnl` | ✅ Migrated | Low | |
| `evidence` | mission snapshot | `evidence.valid/required` | ✅ Migrated | Low | |
| Open / closed counts | mission snapshot | `positions.openTradeCount`, `trades.closed.length` | ✅ Migrated | Low | |
| Core health | `/api/health/engine` or snapshot | `health` from bundle | ✅ Migrated | Low | |
| Live locked | env / operator | `risk.liveLocked` | ✅ Migrated | Low | |
| Binance status | embedded in snapshot | `/api/core/ui/context` → `binanceStatus` | ✅ Migrated | Low | Shared diagnostics shape |
| Preview / swarm / modals | mission snapshot | `/api/core/ui/context` | ✅ Migrated | Medium | Non-critical supplemental context |
| Exec safety / MVP5 readiness | local derive in snapshot view | `/api/core/ui/context` | ⚠️ Partial | Medium | Server-derived, not projection FSM |

**Removed local logic:** Dashboard no longer calls `/api/mission/snapshot` for equity, PnL, evidence, or trade counts.

---

### `/trades` — Trades (`src/app/trades/page.tsx`)

| Field | Previous source | Target projection | Migration status | Risks | Notes |
|-------|-----------------|-------------------|------------------|-------|-------|
| Trade list | `/api/trades` | `/api/core/projections/trades` | ✅ Migrated | Low | Enriched server-side |
| Open / closed counts | trade store summary | `summary.openCount/closedCount` | ✅ Migrated | Low | From projection |
| Realized PnL | trade store | `summary.realizedPnl` | ✅ Migrated | Low | |
| Position snapshots | trade enrich | projection enrich | ✅ Migrated | Low | |
| Close preview | trade enrich | projection enrich | ✅ Migrated | Low | |

**Removed local logic:** No UI-side closed-status inference; suggestions not shown as trades.

---

### `/ai-status` — AI Status (`src/app/ai-status/page.tsx`)

| Field | Previous source | Target projection | Migration status | Risks | Notes |
|-------|-----------------|-------------------|------------------|-------|-------|
| Core health | none / engine health | bundle `health` | ✅ Migrated | Low | |
| `latestRunId` | `/api/analysis/latest` | `mission.latestRunId` + analysis fallback | ✅ Migrated | Low | |
| `latestDecisionLogId` | analysis API | `mission.latestDecisionLogId` | ✅ Migrated | Low | |
| Live locked | none | `risk.liveLocked` | ✅ Migrated | Low | |
| Event journal tail | `/api/journal/events` | same (journal is SoT) | ✅ Kept | Low | Not replaced by projections |
| Lifecycle trace | event filter | events + optional trace API | ⚠️ Partial | Medium | `/api/core/trace/[id]` not wired in UI yet |
| MiroFish advisory | analysis API | analysis API | ✅ Kept | Low | Advisory, not critical state |
| Safety blockers | execution review API | review + `health.blockingIssues` | ⚠️ Partial | Medium | Review API still used |

---

### `/reports` — Reports (`src/app/reports/page.tsx`)

| Field | Previous source | Target projection | Migration status | Risks | Notes |
|-------|-----------------|-------------------|------------------|-------|-------|
| Mission equity / progress | reports summary | `projMission` from bundle | ✅ Migrated | Low | Primary stats |
| Net PnL | reports summary | `projPnl.totalNetPnl` | ✅ Migrated | Low | |
| Evidence | reports summary | `projEvidence` | ✅ Migrated | Low | |
| Core health / risk | reports summary | bundle `health`, `risk` | ✅ Migrated | Low | |
| Briefing / audit / replay | `/api/reports/summary` | legacy summary | ⚠️ Legacy | Medium | Labeled "Legacy reference only" where shown |
| Execution safety gate | reports summary | legacy | ⚠️ Legacy | Medium | Supplemental gate status |
| Binance panel | reports summary | legacy `binanceStatus` | ⚠️ Legacy | Low | Should align via consistency check |

**Removed as primary:** Local evidence/readiness computation removed from primary stat cards.

---

### `/settings` — Settings (`src/app/settings/page.tsx`)

| Field | Previous source | Target projection | Migration status | Risks | Notes |
|-------|-----------------|-------------------|------------------|-------|-------|
| Binance status | `/api/binance/status` | same | ✅ Migrated | Low | Shared API |
| Core health | none | bundle `health` | ✅ Migrated | Low | Stat card added |
| Live locked | kill switch only | `risk.liveLocked` | ✅ Migrated | Low | |
| Engine health diagnostics | `/api/health/engine` | legacy | ⚠️ Legacy | Low | Labeled "legacy reference only" |
| Secrets | never exposed | never exposed | ✅ OK | Low | |

---

### `/operator` — Operator (`src/app/operator/page.tsx`)

| Field | Previous source | Target projection | Migration status | Risks | Notes |
|-------|-----------------|-------------------|------------------|-------|-------|
| Operator controls | `/api/operator/status` | same | ✅ Kept | Low | Actions unchanged |
| Core health | none | bundle `health` | ✅ Migrated | Low | |
| Live locked | operator status | `risk.liveLocked` | ✅ Migrated | Low | |

---

## Shared Components / Infrastructure

| Component / module | Role | Migration status |
|--------------------|------|------------------|
| `src/lib/core/projection-client.ts` | Typed fetch helpers + zero-state | ✅ Created |
| `src/lib/core/projection-bundle.ts` | Server bundle builder | ✅ Created |
| `src/components/use-projection-bundle.tsx` | Client hook | ✅ Created |
| `src/lib/core/ui-context.ts` | Non-critical dashboard context | ✅ Created |
| `src/lib/core/ui-consistency-check.ts` | Cross-page parity | ✅ Created |
| `GET /api/core/projections/bundle` | Combined projections | ✅ Created |
| `GET /api/core/ui-consistency` | Consistency report | ✅ Created |
| `GET /api/core/projections/pnl` | PnL projection | ✅ Created |
| `GET /api/core/projections/risk` | Risk projection | ✅ Created |

---

## Critical State — Local Computation Findings (Pre-Migration)

| Pattern | Found in | Resolution |
|---------|----------|------------|
| `currentEquity` local calc | `mission-snapshot.ts` (server), was exposed via `/api/mission/snapshot` | UI reads `mission` projection |
| `progressPct` local calc | same | UI reads projection |
| Open/closed trade counts | trade store / snapshot | UI reads trade + position projections |
| PnL local calc | `calculate-pnl`, reports summary | UI reads `pnl` projection |
| Evidence progress local calc | evidence-progress derive | UI reads `evidence` projection |
| Risk state local infer | client env on some paths | UI reads `risk` projection |
| Duplicate Binance fetch | dashboard snapshot, reports, ai-status, settings | Shared `/api/binance/status` + consistency check |
| Permanent Loading | snapshot blocking all render | Split critical (bundle) vs supplemental (context) |
| stale localStorage for critical state | Not used for equity/PnL | No change needed |

---

## Legacy APIs Retained (Parity Period)

- `GET /api/mission/snapshot`
- `GET /api/trades`
- `GET /api/reports/summary`
- `GET /api/health/engine`

These remain until Slice 8 parity verification and deprecation.

---

## Overall Risks

1. **Dual sources on Reports** — Primary stats from projections; briefing/audit/replay still from legacy summary.
2. **UI context API** — Dashboard supplemental state is server-derived but not part of formal projection registry.
3. **Trace API unused in AI Status UI** — Lifecycle shown via journal event filter, not `/api/core/trace/[id]`.
4. **Consistency check** — Validates server-side parity; does not run in browser automatically.

---

## Recommendation

Proceed to **Slice 8**: projection parity tests vs legacy APIs, deprecate `/api/mission/snapshot` for UI, wire trace panel on AI Status, and auto-run UI consistency in CI.
