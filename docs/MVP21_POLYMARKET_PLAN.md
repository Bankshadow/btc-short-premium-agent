# MVP 21 — Polymarket Microstructure & Mispricing Engine (Plan)

Date: 2026-06-12  
Branch: `v2-core`  
Module namespace: `polymarket` (sprint label: `mvp-21-polymarket`)

> **Naming note:** v2 already uses MVP 21 for **Portfolio Risk Manager** (`src/lib/portfolio-risk/`). This MVP is a separate simulation desk and does not replace or extend portfolio-risk.

---

## 1. Goal

Build a **paper-only** Polymarket mispricing desk that:

- Monitors crypto-related Polymarket markets (BTC/ETH Up-Down, above/below, price targets)
- Compares Polymarket prices with external crypto spot data
- Estimates fair probability (rule-based v1)
- Detects short-lived edge after spread, liquidity, latency, and time-remaining adjustments
- Simulates paper trades and logs risk blocks
- Provides operator dashboard + AI-readable commentary (rule-based, no LLM required)

**Never:** real-money execution, wallet signing, automated fund movement, or live order placement.

---

## 2. Preconditions

| Check | Status |
|-------|--------|
| v2 journal + API route patterns stable | ✅ |
| Binance testnet loop separate from Polymarket | ✅ |
| Live locked globally | ✅ |
| Mock adapters acceptable for MVP | ✅ |

---

## 3. Architecture (target)

```text
Adapter layer (mock → real later)
  MockPolymarketAdapter ──► market-discovery
  MockCryptoDataAdapter ──┘
                              │
                              ▼
                    fair-probability-engine
                              │
                              ▼
                    mispricing-detector
                              │
                              ▼
                       risk-manager ──► blocked signals / risk log
                              │
                              ▼
                  paper-trading-simulator
                              │
         polymarket-store.json ◄┴──► journal events (environment: simulation)
                              │
                        /polymarket dashboard
```

### Persistence strategy

| Layer | Purpose |
|-------|---------|
| **Journal** | Audit trail: scan started, signals created/blocked, paper trades, risk events, cycle completed |
| **JSON store** (`data/polymarket/polymarket-store.json`) | Dashboard read model: latest markets, fair prices, signals, paper trades, health |

Polymarket is **not** wired into the Binance execute guard chain.

---

## 4. Module breakdown

| # | Component | Responsibility |
|---|-----------|----------------|
| 1 | Market discovery | Fetch/filter ACTIVE crypto Polymarket markets |
| 2 | Crypto data adapter | BTC/ETH spot, short-window change, vol, momentum, quality |
| 3 | Fair probability engine | Rule-based fair YES/NO + confidence + assumptions |
| 4 | Mispricing detector | Edge, execution score, latency risk, opportunity score |
| 5 | Paper trading simulator | Simulated fill, MTM PnL, no wallet |
| 6 | Risk manager | Exposure caps, spread/liquidity/stale blocks, kill switch |
| 7 | Commentary layer | Rule-based explain signal/block/mispricing/pre-live review |
| 8 | Health | Data freshness, subsystem status, error count |
| 9 | Dashboard | Sections A–E + run cycle control |
| 10 | Config | Env-driven thresholds; `real_trading_enabled = false` always |

---

## 5. API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/polymarket/status` | Full dashboard payload |
| GET | `/api/polymarket/markets` | Active markets |
| GET | `/api/polymarket/crypto` | BTC/ETH snapshots |
| GET | `/api/polymarket/signals` | Signals + blocked |
| GET | `/api/polymarket/paper-trades` | Simulated trades |
| GET | `/api/polymarket/risk-log` | Risk events |
| GET | `/api/polymarket/health` | Health report |
| POST | `/api/polymarket/run` | Run full scan cycle |
| GET/POST | `/api/polymarket/kill-switch` | Simulation kill switch (`doubleConfirm` on POST) |

---

## 6. Dashboard sections

| Section | Columns (summary) |
|---------|-------------------|
| A. Active markets | Market, asset, end time, yes/no, bid/ask, liquidity, volume, status |
| B. Fair price monitor | Market, poly price, fair prob, diff, confidence, model reason |
| C. Mispricing signals | Time, market, side, prices, edge, confidence, risk flags, status |
| D. Paper trades | Time, market, side, entry, size, current, unrealized/realized PnL, status |
| E. Risk log | Time, market, rule, severity, action, reason |

Route: **`/polymarket`**

---

## 7. Configuration (env)

See [MVP21_POLYMARKET_IMPLEMENTATION.md](./MVP21_POLYMARKET_IMPLEMENTATION.md) for full env table.

Key safety defaults:

- `POLYMARKET_PAPER_ENABLED=true`
- `POLYMARKET_KILL_SWITCH=false`
- `real_trading_enabled` hardcoded **false** in code

---

## 8. Journal events

| Event | When |
|-------|------|
| `POLYMARKET_SCAN_STARTED` | Cycle begins |
| `POLYMARKET_SIGNAL_CREATED` | Signal passes risk |
| `POLYMARKET_SIGNAL_BLOCKED` | Signal rejected by risk |
| `POLYMARKET_PAPER_TRADE_CREATED` | Paper fill simulated |
| `POLYMARKET_RISK_EVENT` | Risk rule triggered |
| `POLYMARKET_CYCLE_COMPLETED` | Cycle ends |

Environment: **`simulation`** (distinct from testnet trading journal)

---

## 9. Safety constraints

- No private keys, wallet signing, or order placement
- Kill switch blocks all paper signals when active
- Risk blocks: min edge, min confidence, max spread, min liquidity, stale data, exposure caps, trades/hour, daily loss
- Not integrated into Binance `guard-chain.ts`
- Commentary explicitly states MVP is not live-ready

---

## 10. Testing

File: `src/lib/polymarket/mvp21-polymarket.test.ts`

Coverage:

- Fair price calculation (up/down, above/below)
- Mispricing detection thresholds
- Risk: wide spread, stale data, kill switch path
- Paper trade creation
- Full cycle → journal + store persistence

Run: `npx tsx --test src/lib/polymarket/mvp21-polymarket.test.ts`

---

## 11. Acceptance criteria

- [x] Display crypto-related Polymarket markets (mock)
- [x] Show external BTC/ETH price data (mock)
- [x] Calculate fair probability (rule-based)
- [x] Detect potential mispricing signals
- [x] Block unsafe signals via risk rules
- [x] Create paper trades only (no real execution)
- [x] Dashboard: markets, fair price, signals, paper trades, risk log
- [x] Modular adapters for future real API integration
- [x] Tests + build pass

---

## 12. Out of scope (MVP)

- Real Polymarket CLOB / Gamma API integration
- Real Binance spot websocket feed
- Core projection bundle wiring (`/api/core/projections/bundle`)
- Vercel Blob persistence for polymarket store (local JSON only in MVP)
- Market resolution → realized PnL from Polymarket settlement
- LLM commentary (rule-based only)
- Automated scheduling / cron (manual `POST /api/polymarket/run` or dashboard button)

---

## 13. Phase 2 (post-MVP)

1. `polymarket-live-adapter.ts` — real Polymarket API
2. `binance-spot-adapter.ts` — reuse exchange client patterns for spot ticks
3. Blob-backed store for production persistence
4. Optional projection slice for main dashboard summary card
5. Resolution handler for settled markets
6. Optional LLM commentary layer

---

## 14. Related docs

- [MVP21_POLYMARKET_IMPLEMENTATION.md](./MVP21_POLYMARKET_IMPLEMENTATION.md) — implementation details and file map
- [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md) — v2 journal-first principles
- Portfolio Risk (existing v2 MVP 21): `src/lib/portfolio-risk/`
