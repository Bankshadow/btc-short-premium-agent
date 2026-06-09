---
name: strategy-backtest
description: >-
  Runs and extends historical desk backtests — bar reconstruction, engine
  replay, metrics, compare runs. Use when implementing backtest features,
  /strategy-lab/backtest, quant imports, or shadow/tournament promotion gates.
---

# Strategy Backtest Skill

Backtests replay the decision engine on historical bars — **advisory only**, no orders.

## Key paths

| Area | Path |
|------|------|
| Core runner | `src/lib/historical-backtest/run-backtest.ts` |
| Engine input | `build-engine-input.ts`, `reconstruct-bar.ts` |
| Metrics | `compute-metrics.ts`, `compare-backtest.ts` |
| Store | `results-store.ts` |
| API | `src/app/api/backtest/run`, `results`, `compare` |
| UI | `/strategy-lab/backtest`, `/backtest` |
| Quant import | `src/lib/quant-strategy-importer/` |
| Shadow mode | `src/lib/strategy-shadow/` (virtual trades, promotion rules) |

## Run workflow

1. Build engine input from warehouse/journal or historical bars.
2. `runBacktest` steps through bars → `runDecisionEngine` per bar.
3. `compute-metrics` → win rate, drawdown, sample size.
4. Persist via `results-store`; expose on API for dashboard.

## Promotion discipline

Before linking backtest results to live/testnet execution:

- Shadow mode: min sample, win rate, max drawdown (`strategy-shadow/compute-metrics.ts`).
- Strategy signals: **advisory only** via `strategy-signals/` — never auto-execute from backtest alone.
- Tournament/lab UIs promote to registry; human approval required.

## Implementation rules

- Keep backtest path free of `binance-execution` imports.
- Reuse `DecisionEngineInput` shape from `src/lib/decision/analyze.ts`.
- Add tests in `historical-backtest.test.ts` for new metrics or bar logic.
- Document assumptions (slippage, fills) in code comments only when non-obvious.

## Verify

```bash
npx --yes tsx --test src/lib/historical-backtest/historical-backtest.test.ts
npm run build
```
