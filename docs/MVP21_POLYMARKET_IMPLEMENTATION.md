# MVP 21 — Polymarket Microstructure & Mispricing Engine

Date: 2026-06-12  
Branch: `v2-core`  
Module path: `src/lib/polymarket/`

> **Note:** v2 already uses MVP 21 for Portfolio Risk Manager. This module is namespaced **`polymarket`** with API sprint label `mvp-21-polymarket`.

## Purpose

Monitor crypto-related Polymarket markets, compare prices with external BTC/ETH data, estimate fair probability, detect short-lived mispricing, and **simulate paper trades only**. No real-money execution, wallet signing, or automated fund movement.

## Architecture

```text
MockPolymarketAdapter ──► market-discovery ──► fair-probability-engine
MockCryptoDataAdapter ──┘                           │
                                                    ▼
                                            mispricing-detector
                                                    │
                                                    ▼
                                              risk-manager ──► blocked signals / risk log
                                                    │
                                                    ▼
                                         paper-trading-simulator
                                                    │
                    polymarket-store.json ◄─────────┴──► journal events (simulation)
                                                    │
                                              /polymarket dashboard
```

## Modules

| Module | File |
|--------|------|
| Types | `types.ts`, `config-types.ts` |
| Config | `config.ts` |
| Polymarket adapter (mock) | `adapters/mock-polymarket-adapter.ts` |
| Crypto data adapter (mock) | `adapters/mock-crypto-data-adapter.ts` |
| Market discovery | `market-discovery.ts` |
| Fair probability | `fair-probability-engine.ts` |
| Mispricing detector | `mispricing-detector.ts` |
| Paper simulator | `paper-trading-simulator.ts` |
| Risk manager | `risk-manager.ts` |
| Commentary | `commentary.ts` |
| Health | `health.ts` |
| Persistence | `store.ts` → `data/polymarket/polymarket-store.json` |
| Orchestrator | `run-cycle.ts` |

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/polymarket/status` | Full dashboard payload |
| GET | `/api/polymarket/markets` | Active markets |
| GET | `/api/polymarket/crypto` | BTC/ETH snapshots |
| GET | `/api/polymarket/signals` | Signals + blocked |
| GET | `/api/polymarket/paper-trades` | Simulated trades |
| GET | `/api/polymarket/risk-log` | Risk events |
| GET | `/api/polymarket/health` | Health report |
| POST | `/api/polymarket/run` | Run full scan cycle |
| GET/POST | `/api/polymarket/kill-switch` | Simulation kill switch |

## Configuration (env)

| Variable | Default |
|----------|---------|
| `POLYMARKET_MIN_EDGE` | `0.03` |
| `POLYMARKET_MIN_CONFIDENCE` | `0.55` |
| `POLYMARKET_MAX_SPREAD` | `0.08` |
| `POLYMARKET_MIN_LIQUIDITY` | `500` |
| `POLYMARKET_MAX_EXPOSURE_PER_MARKET` | `100` |
| `POLYMARKET_MAX_EXPOSURE_TOTAL` | `500` |
| `POLYMARKET_MAX_TRADES_PER_HOUR` | `20` |
| `POLYMARKET_MAX_DAILY_LOSS` | `50` |
| `POLYMARKET_MIN_TIME_REMAINING_SEC` | `120` |
| `POLYMARKET_STALE_DATA_SEC` | `30` |
| `POLYMARKET_PAPER_ENABLED` | `true` |
| `POLYMARKET_KILL_SWITCH` | `false` |
| `POLYMARKET_MOCK_MODE` | `true` |
| `POLYMARKET_DATA_DIR` | `./data/polymarket` |

`real_trading_enabled` is **hardcoded false** in code.

## Journal events

- `POLYMARKET_SCAN_STARTED`
- `POLYMARKET_SIGNAL_CREATED`
- `POLYMARKET_SIGNAL_BLOCKED`
- `POLYMARKET_PAPER_TRADE_CREATED`
- `POLYMARKET_RISK_EVENT`
- `POLYMARKET_CYCLE_COMPLETED`

Environment: `simulation`

## Dashboard

Route: **`/polymarket`**

Sections: Active markets, Fair price monitor, Mispricing signals, Paper trades, Risk log, AI commentary.

## Safety

- Paper / simulation only
- Kill switch with `doubleConfirm`
- Risk blocks: spread, liquidity, stale data, exposure caps, daily loss, trades/hour
- No private keys or order placement

## Tests

```bash
npx tsx --test src/lib/polymarket/mvp21-polymarket.test.ts
```

Covers: fair price, mispricing, risk blocking, paper trades, stale data, cycle persistence.

## Future integration

1. Replace `MockPolymarketAdapter` with Polymarket CLOB/Gamma API
2. Replace `MockCryptoDataAdapter` with Binance/Bybit websocket or REST
3. Add resolution handler for realized PnL on settled markets
4. Optional LLM commentary layer (currently rule-based)

## Acceptance criteria

- [x] Display crypto Polymarket markets (mock)
- [x] Show BTC/ETH external data (mock)
- [x] Calculate fair probability (rule-based)
- [x] Detect mispricing signals
- [x] Block unsafe signals via risk rules
- [x] Create paper trades only
- [x] Dashboard with all five sections + commentary
- [x] No real-money execution
- [x] Modular adapters for future API swap
