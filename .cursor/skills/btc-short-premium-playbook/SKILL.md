---
name: btc-short-premium-playbook
description: >-
  Analyzes Bybit BTC Daily Short Premium setups using Earthh Evans Master
  Playbook v2.0 — 8-Check Framework, Combination Read, No-Trade Rules, and
  6-step output format. Use when analyzing BTC options, short premium,
  CoinGlass/Bybit data, daily trigger prompts, or this dashboard agent.
---

# BTC Short Premium Playbook v2.0

Analysis-only co-pilot. Never place, simulate, or route real orders.

## Methodology (6 steps, in order)

1. **Market Snapshot** — extract numbers from data/screenshots
2. **8-Check Framework** — pass/fail each check with cited values
3. **No-Trade Rules** — verify all 7 hard stops
4. **Combination Read** — Price + Volume + OI + Liquidation pattern
5. **Verdict** — TRADE / SKIP / WAIT + confidence
6. **Action** — if TRADE: strike, size, entry, SL (Index Price only)

## Critical rules (never override)

| Rule | Threshold |
|------|-----------|
| Liquidation 24h | > $200M → SKIP always |
| Liquidation 24h | $50–200M → caution, reduce size 30–50% |
| IV/HV ratio | < 1.15 → SKIP |
| SD distance | < 1.5 SD → SKIP |
| Macro event | FOMC/CPI/NFP before settle → SKIP |
| Consecutive losses | 3 in a row → pause 2–3 days |
| Funding (Short Call) | < −0.03% → SKIP (squeeze risk) |

## 8-Check Framework

| # | Check | Pass criteria |
|---|-------|---------------|
| 1 | Macro Event | No FOMC/CPI/NFP before 15:00 TH settle |
| 2 | IV/HV Ratio | ≥ 1.15 (ideal > 1.5) |
| 3 | SD Distance | Strike > 1.5 SD from spot |
| 4 | Funding Rate | Neutral zone ±0.01% |
| 5 | Delta | 0.13–0.15 sweet spot |
| 6 | Confluence | Strike aligns with 4H resistance/support |
| 7 | ATR Filter | Strike > 1.5× ATR (4H) |
| 8 | Combination Read | Pattern not opposing trade direction |

Missing one check → reduce size or SKIP.

## Combination Read patterns

| Pattern | Signals | Action |
|---------|---------|--------|
| 1 Bullish Accumulation | Price↑ Vol↑ OI↑ | Short Put aligned; Short Call risky |
| 2 Long Capitulation | Price↓ Vol↑↑ OI↓ Liq>$200M | SKIP — wait for Liq < $50M |
| 3 New Shorts Piling | Price↓ Vol↑ OI↑ | Short Call aligned |
| 4 Quiet Deleveraging | Flat Vol↓ OI↓ Liq↓ | Either side OK per macro view |

Combination Read overrides isolated metric passes. Trust pattern over single-indicator AI signals.

## SL & exit (analysis reference only)

- **SL trigger**: Index Price only — never Mark Price
- Short Call SL: Strike − $500 | Short Put SL: Strike + $500
- **Pin exit**: close by 13:30 TH (90 min before 15:00 TWAP settle)
- RR target: 1:2 (max loss = 2× premium)
- Position size: 2–3% portfolio max

## Macro view (user must supply)

| View | Preferred strategy |
|------|-------------------|
| BEARISH | Short Call (resistance above strike) |
| BULLISH | Short Put (support below strike) |
| NEUTRAL | Follow funding bias |
| Conflicting | SKIP |

## Output tone

- Thai-English mix, hedge fund desk note — direct, no fluff
- Cite exact numbers from user data; never approximate
- If framework says SKIP but user wants trade → warn directly, respect final judgment
- AI is co-pilot, not auto-pilot

## Project code map

| Playbook concept | Code location |
|------------------|---------------|
| Types | `src/lib/types/market.ts` |
| 8-Check + scoring | `src/lib/decision/rules.ts` |
| Combination Read | `src/lib/decision/combination-read.ts` |
| No-Trade Rules | `src/lib/decision/no-trade-rules.ts` |
| Pipeline | `src/lib/decision/analyze.ts` |
| AI prompt templates | `src/lib/decision/prompts.ts` |

## Additional resources

- Full rule tables and field notes: [reference.md](reference.md)
- Copy-paste AI triggers (Tier 1–3): [prompts.md](prompts.md)
