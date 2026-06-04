# Trading Desk MVP Roadmap

Analysis-only desk — no live exchange execution unless explicitly scoped in a future MVP.

## Completed

| MVP | Focus |
|-----|--------|
| 1–2 | Playbook engine + TradingAgents-style bull/bear, strategies, risk, committee |
| 3 | Decision log, paper outcomes, reflection, scoreboard, draft rules |
| 4 | Desk memory (journal → agents, advisory only) |
| 5 | Research layer (market data, regime, data quality, macro, ETH/BTC) |
| 6 | Portfolio milestones, session replay, journal Supabase sync, cron desk briefing |

---

## MVP 7 — Operator Control & Alerting

**Goal:** Human-in-the-loop controls without breaking analysis-only guardrails.

### Scope

1. **Alert routing**
   - Telegram templates per verdict (TRADE / SKIP / WAIT / veto)
   - Optional Discord webhook
   - Quiet hours (Bangkok TZ) — no ping overnight unless veto

2. **Desk presets**
   - Save/load macro + override presets (JSON local + optional Supabase `desk_presets`)
   - Quick switch: “FOMC week”, “Normal day”, “Post-cascade”

3. **Manual committee override (logged)**
   - Operator marks “I disagree” with reason → stored in decision log
   - Does **not** change engine veto; audit trail only

4. **Health dashboard**
   - Bybit fetch success rate, last cron, last Supabase sync, paper open count

### Deliverables

- `src/lib/alerts/` — routing + templates
- `src/app/api/alerts/test/route.ts`
- UI: **Operator panel** in Operations accordion

### Success criteria

- Cron + manual test send correct template
- Preset restores macro/overrides in one click
- Override notes appear in replay + journal sync

---

## MVP 8 — Intelligence Upgrade (LLM + Backtest)

**Goal:** Optional LLM narration on top of deterministic desk; offline backtest of rules.

### Scope

1. **LLM narrator (optional, env-gated)**
   - After committee: 3–5 sentence Thai/EN desk note from structured JSON only
   - Never changes verdict; `OPENAI_API_KEY` or compatible API on server only
   - Fallback: template text if LLM off

2. **Rule backtest / replay engine**
   - Replay N past `analysis_runs` or local logs through **current** no-trade rules
   - Report: “would SKIP now” delta %

3. **Agent calibration report**
   - Monthly PDF/markdown: scoreboard + milestone + regime breakdown
   - Export from Supabase + local merge

4. **ETH/BTC regime module v2**
   - Rolling correlation window (7d) when historical series available (CoinGlass / stored runs)

### Deliverables

- `src/lib/llm/desk-narrator.ts` (server-only)
- `src/lib/backtest/replay-rules.ts`
- UI: **Backtest** tab + export button

### Success criteria

- LLM off → desk unchanged
- Backtest runs on 10+ stored runs without timeout on Vercel (background job or client-only for small N)

---

## Suggested order after MVP 6

```
MVP 7 (ops)  →  MVP 8 (LLM/backtest)
```

Supabase migrations to plan for MVP 7–8:

- `004_desk_presets.sql`
- `005_operator_overrides.sql`
- `006_alert_delivery_log.sql` (optional)

---

## Environment checklist (all MVPs)

| Variable | Used for |
|----------|----------|
| `SUPABASE_URL` | analysis_runs, paper_orders, decision_log_entries |
| `SUPABASE_SERVICE_ROLE_KEY` | server sync only |
| `CRON_SECRET` | Vercel cron + test automation |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | briefing alerts |
| `OPENAI_API_KEY` (MVP 8) | optional narrator |

Run SQL in order: `001` → `002` → `003` in [supabase/migrations](../supabase/migrations/).
