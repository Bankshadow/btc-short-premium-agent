# MVP 6 — PnL Fill Data Plan

Date: 2026-06-11  
Branch: `v2-core`  
Scope: Realized PnL pipeline for testnet closed trades (no live trading)

## Precondition: UI binding

Verified on production before MVP 6 work:

| Check | Result |
|-------|--------|
| Dashboard `Projection source` | `REAL_BUNDLE` |
| Dashboard `totalTrades` vs `/api/core/projections/bundle` | Matches (8) |
| Core / Trades / Reports | `REAL_BUNDLE` |
| Closed trades rendered from bundle | Yes |

UI binding is correct — MVP 6 proceeded.

---

## 1. Current data available

From journal events per closed trade:

| Source event | Fields |
|--------------|--------|
| `ORDER_EXECUTED` | `symbol`, `side`, `qty`, `avgPrice`, `entryPrice`, `fee` |
| `POSITION_OPENED` | `entryPrice`, `qty`, `positionId` |
| `CLOSE_ORDER_EXECUTED` | `avgPrice`, `executedQty`, `fee` |
| `POSITION_CLOSED` | `symbol`, `qty`, `realizedPnlPending`, `source` |
| `PNL_REALIZED` | Full realized record when previously calculated |
| `PNL_PENDING_DATA` | Recorded pending reasons |

Projection bundle already exposes:

- 8 closed trades (`CLOSED_PENDING_PNL` / `PENDING_PNL`)
- 0 realized PnL (`PNL_REALIZED` count = 0)
- Evidence strict rejection (8 rejected, 0 valid)

## 2. Current data missing (production blockers)

Most closed testnet trades lack complete fill data:

| Gap | Impact |
|-----|--------|
| `entryPrice` null on `POSITION_OPENED` / `ORDER_EXECUTED` | Cannot compute gross PnL |
| `CLOSE_ORDER_EXECUTED.avgPrice` missing or 0 | No exit price |
| `qty = 0` on reconciliation backfill trades | ZERO_QTY |
| No `PNL_REALIZED` event | Mission netPnl stays 0 |
| No `LEARNING_RECORD_CREATED` after PnL | Evidence remains rejected even after PnL |

## 3. Required fields for valid PnL

See `src/lib/pnl/pnl-types.ts` → `PnlInput`:

- `tradeId`, `positionId`, `symbol`
- `side` (`LONG` / `SHORT`)
- `qty > 0`
- `entryPrice > 0`, `exitPrice > 0`
- `entryFee`, `exitFee` (0 allowed with warning)
- `openedAt`, `closedAt` (`closedAt >= openedAt`)
- `environment` ∈ `{ TESTNET, PAPER }` (never `LIVE`)

## 4. Where fill data should come from

1. **Primary:** journal events written by testnet execution path (`ORDER_EXECUTED`, `CLOSE_ORDER_EXECUTED`)
2. **Secondary:** Binance testnet order/fill read APIs (read-only; no new order placement)
3. **Never:** invented prices, assumed $0 realized PnL, or forced evidence pass

## 5. Fallback behavior when data is missing

Lifecycle:

```
POSITION_CLOSED
  → PNL_CALCULATION_STARTED
  → validate PnlInput
  → PNL_PENDING_DATA (reasons[])   OR   PNL_REALIZED
  → TRADE_RESULT_CLASSIFIED        (only if REALIZED)
  → MISSION_SNAPSHOT_UPDATED       (only if REALIZED)
```

Pending reasons: `MISSING_ENTRY_PRICE`, `MISSING_EXIT_PRICE`, `ZERO_QTY`, `MISSING_FILL_DATA`, etc.

UI label: **"PnL pending — missing fill data."**

## 6. Safety constraints

- Live trading remains locked (`BINANCE_LIVE_ENABLED=false`)
- `LIVE` environment blocked in calculator
- No secrets in API responses
- Evidence strictness unchanged — `PENDING_PNL` rejected; `PNL_REALIZED` alone insufficient without learning
- Idempotent `PNL_REALIZED` — duplicate events not created
- No fake zero-fill `PNL_REALIZED` (removed `ZERO_FILL_RECONCILIATION` shortcut)

---

## Implementation map

| Component | Path |
|-----------|------|
| Types | `src/lib/pnl/pnl-types.ts` |
| Calculator | `src/lib/pnl/pnl-calculator.ts` |
| Engine | `src/lib/pnl/pnl-engine.ts` |
| Pending list | `src/lib/pnl/pnl-pending.ts` |
| API calculate | `POST /api/pnl/calculate` |
| API pending | `GET /api/pnl/pending` |
| Projections | `src/lib/core/projections/pnl-projection.ts` |
| UI | `/trades`, `/core`, `/reports` |
