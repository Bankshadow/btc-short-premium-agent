# Master Playbook v2.0 — Reference

Source: Earthh Evans BTC Daily Short Premium Master Playbook v2.0

## Daily workflow (TH timezone)

| Time | Activity |
|------|----------|
| 07:00–07:15 | Open 4 tools; capture 5 screenshots |
| 07:15–07:30 | Run full analysis |
| 07:30–07:45 | Read verdict; decide trade/skip |
| 07:45–08:00 | If trade: hypothetical entry + SL (Index Price) |
| 08:00–13:00 | Monitor theta; check 1–2× |
| 13:30 | Pin risk exit — close before TWAP window |
| 15:00 | Settlement; log in journal |

## Required data sources

1. **CoinGlass** — Funding, OI, Liquidation, Volume 24h%
2. **Bybit Option Chain** — Bid, Mark, Ask, Delta, IV for today's expiry
3. **TradingView** — Daily (macro), 4H (strike), 1H (timing)
4. **ForexFactory** — FOMC/CPI/NFP calendar (Bangkok TZ)

## IV/HV ratio tiers

| Ratio | Interpretation |
|-------|----------------|
| < 1.0 | SKIP — selling cheap |
| 1.0–1.15 | Borderline |
| 1.15–1.5 | OK — normal edge |
| > 1.5 | Sweet spot — vol spike opportunity |

## Liquidation tiers

| 24h Liquidation | Regime | Action |
|-----------------|--------|--------|
| > $200M | Cascade | SKIP always |
| $150–200M | Pre-cascade | SKIP |
| $50–150M | Borderline | Reduce size; wider strike |
| < $50M | Safe zone | Full framework applies |

## Funding rate zones

| Funding | Bias | Short Call | Short Put |
|---------|------|------------|-----------|
| > +0.03% | Long crowded | OK | Avoid |
| ±0.01% | Neutral | OK | OK |
| < −0.03% | Short crowded | SKIP | Caution |

## Strike selection by regime

| Regime | SD distance | Delta | Size |
|--------|-------------|-------|------|
| Quiet (Liq < $50M) | 1.5–2 SD | 0.13–0.15 | Full |
| Borderline ($50–150M) | 2–2.5 SD | 0.08–0.12 | 70% |
| Recovery (post-cascade) | 2.5+ SD | 0.05–0.08 | 50% |
| Macro event nearby | 3+ SD or skip | < 0.05 | 30% or skip |

## SD distance formula

```
SD = Spot × IV × √(1/365)
Min strike distance = 1.5 × SD
```

Example: BTC $74,000, IV 30% → SD ≈ $1,162 → min distance $1,743

## No-Trade Rules (7 hard stops)

1. FOMC/CPI/NFP day = SKIP
2. IV/HV < 1.0 = SKIP
3. BTC rallied 5%+ prior day = SKIP
4. 3 consecutive losses = pause 2–3 days
5. Liquidation > $200M = SKIP
6. Funding < −0.03% = SKIP Short Call
7. Gut uncertainty = SKIP

## Mark Price anomaly

Bybit daily options have thin liquidity. Mark Price uses IV model — can show fake losses at open.

- Use **BTC Index Price** for SL trigger
- Use **Ask Price** to estimate close cost
- Ignore Mark Price for first 30 minutes after entry

## Key numbers

| Metric | Target |
|--------|--------|
| Win rate (with SL) | 85–93% |
| Delta sweet spot | 0.13–0.15 |
| Risk/reward | 1:2 |
| Time to expiry | 8–24 hours |
| Portfolio per trade | 2–3% max |
| Daily target | $10–30 on $5–10K |

## Settlement

- Bybit daily options settle **15:00 TH** (08:00 UTC)
- Settlement = TWAP of Index Price, last 30 minutes
- Do not hold through TWAP window (14:30–15:00) — gamma squeeze risk
