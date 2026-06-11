# Core Engine Partial Stability Fix

Branch: **`v2-core`**  
Date: **2026-06-06**  
Scope: Fix timeout APIs, stale trade reconciliation, lifecycle warning flood, PnL pending policy, evidence dedupe

---

## 1. Root cause

Production `/core` showed **CORE_ENGINE_PARTIAL** behavior:

| Symptom | Root cause |
|---------|------------|
| `/api/core/ui-consistency` timeout | Rebuilt projection bundle, enriched trades (async close previews), and Binance status on every request |
| `/api/core/projection-parity` timeout | Called `buildReportsSummary()` (swarm/briefing/audit) plus legacy `getTradesSummary()` enrichment on every request |
| OPEN trade + FLAT position | `buildOpenTradesFromEvents` kept journal OPEN trades even when latest `POSITION_MONITORED` snapshot was FLAT / qty 0 |
| Health WARNING flood | `validateAllTradeLifecycles` emitted one warning per issue per trade with no aggregation |
| Evidence 0/12 noise | `MISSING_PNL_REALIZED` duplicated in evidence validator loop + explicit check |
| PnL pending unclear | Closed trades without `PNL_REALIZED` or fill prices still surfaced as normal closed trades |

---

## 2. Timeout APIs fixed

### UI consistency (`GET /api/core/ui-consistency`)

- Single `buildProjectionBundle()` read; no Binance call, no enriched-trade rebuild
- Browser-only checks marked **SKIPPED** (dashboard DOM equity, reports page equity, Binance browser status)
- 5s bounded via `withBoundedCheck`; returns partial JSON on timeout (never hangs)
- Response envelope: `{ ok, data, error }`

### Projection parity (`GET /api/core/projection-parity`)

- Skips `buildReportsSummary()` and async enriched-trade path
- Uses bundle `meta.eventCount` / `cacheKey`
- Legacy parity from sync builders only (`buildMissionSnapshot`, trade-store, evidence)
- Large journals: defers full trade replay (summary first)
- 5s bounded; returns WARNING + partial result instead of timeout
- Response envelope: `{ ok, data, error }`

---

## 3. Stale OPEN trade / FLAT position

New module: `src/lib/core/trade-reconciliation.ts`

Rule: if `trade.status = OPEN` and latest matching position snapshot is **FLAT** or **qty = 0**:

| Condition | Projected status |
|-----------|------------------|
| `CLOSE_ORDER_EXECUTED` or `POSITION_CLOSED` exists | `CLOSED_PENDING_PNL` |
| No close event | `RECONCILIATION_REQUIRED` + `MANUAL_REPAIR_REQUIRED` |

- Warning code: `LOCAL_OPEN_TRADE_BUT_EXCHANGE_FLAT`
- Stale trades **excluded** from `effectiveOpenCount` (does not misread `maxOpenPositions`)
- No silent mutation of historical journal events

Integrated into: `trade-projection`, `position-projection`, `mission-snapshot`, `build-enriched-trade-projection`, `getTradesSummary`

---

## 4. Lifecycle warning aggregation

New module: `src/lib/core/health-warning-aggregate.ts`

`evaluateCoreHealth()` now returns:

```json
{
  "warnings": [
    {
      "code": "SKIPPED_LIFECYCLE_STEP",
      "count": 12,
      "affectedTradeIds": ["trade-..."],
      "severity": "WARNING",
      "message": "12 lifecycle step skips detected.",
      "examples": [{ "message": "...", "tradeId": "..." }]
    }
  ],
  "rawWarningCount": 47
}
```

- Grouped by code
- Count, affected trade IDs, first 5 examples
- `blockingIssues` remain unaggregated (typically few)

---

## 5. PnL pending policy

Closed trades missing `PNL_REALIZED`, entry/exit price, or fill data:

| Field | Value |
|-------|-------|
| `status` | `CLOSED_PENDING_PNL` |
| `result` | `PENDING_PNL` |
| `netPnl` | `0` (placeholder only) |
| `pnlStatus` | `PENDING_DATA` |

- **No fake `PNL_REALIZED` events** are generated
- Evidence rejects with `MISSING_PNL_REALIZED` (once per trade)
- Evidence message appends: *"PnL pending: missing entry/exit price or fill data."*

---

## 6. Evidence dedupe

`validateTradeEvidence()` dedupes `rejectionReasons` via `Set`.

Removed duplicate explicit `MISSING_PNL_REALIZED` push (loop already covers `PNL_REALIZED` in `EVIDENCE_REQUIRED_EVENTS`).

---

## 7. `/core` page improvements

- No full-page blocking `LoadingOrError` on consistency/parity timeout
- Shows UI consistency status: OK / WARNING / BLOCKED / **TIMEOUT_FIXED**
- Shows projection parity status
- Aggregated health warning counts (`rawWarningCount` → grouped)
- Stale trade reconciliation panel when applicable
- Next action: *"Fix pending PnL and lifecycle gaps before CORE_ENGINE_STABLE."*

---

## 8. Tests added

`src/lib/core/core-partial-stability.test.ts` (15 tests):

- ui-consistency within timeout + partial/skipped checks
- projection-parity within timeout + partial result
- OPEN + FLAT → `CLOSED_PENDING_PNL` / `RECONCILIATION_REQUIRED`
- health warning aggregation
- evidence rejection dedupe
- closed pending PnL without fake `PNL_REALIZED`
- live trading remains disabled
- no secrets in health payload

---

## 9. Remaining blockers for CORE_ENGINE_STABLE

| Blocker | Status |
|---------|--------|
| ui-consistency returns within 5s | Fixed (deploy to verify) |
| projection-parity returns within 5s | Fixed (deploy to verify) |
| P0/P1 lifecycle gaps in production journal | **Data repair required** — missing `CLOSE_REVIEWED`, `PNL_REALIZED`, `LEARNING_RECORD_CREATED` on closed trades |
| Evidence 0/12 | Expected until valid closed-trade lifecycle completes |
| Stale OPEN trade | Reconciled in projections; manual repair may still be needed for journal integrity |

**Recommendation:** `CORE_ENGINE_PARTIAL` until production deploy confirms APIs respond and journal lifecycle gaps are addressed. See [CORE_ENGINE_STABLE_REPORT.md](./CORE_ENGINE_STABLE_REPORT.md).

---

## Safety constraints preserved

- Live trading remains locked
- No risk / execution / close safety gate bypass
- No forced evidence validation
- No silent historical event rewrite
- No fake PnL
- No secrets exposed in API responses
