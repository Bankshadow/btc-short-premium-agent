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
| 9 | Operator hub: alerts, risk profile, narrator, backtest, desk APIs, webhooks |

---

## MVP 9 — Operator Hub & Desk Signals ✅

**Goal:** Operations layer — alerts, external signals, narrator, and rule backtest without live execution.

### Delivered

1. **Alert routing** — verdict templates; cron quiet hours 22:00–08:00 BKK; TRADE/veto full briefing
2. **Risk profile** — `balanced` | `aggressive` (UI + `deskRiskProfile` on analyze)
3. **Operator override** — audit-only disagree + reason → decision log
4. **Desk APIs** — `GET /api/desk/status`, `GET /api/desk/health`, `POST /api/alerts/test`
5. **Webhooks** — `DESK_WEBHOOK_URL` on TRADE/analyze; optional `DISCORD_WEBHOOK_URL`
6. **LLM narrator** — `OPENAI_API_KEY` optional; template fallback (Thai default)
7. **Rule backtest** — client replay of last N logs vs current rules

### Env (MVP 9)

| Variable | Purpose |
|----------|---------|
| `DESK_RISK_PROFILE` | Server default `balanced` \| `aggressive` |
| `DESK_WEBHOOK_URL` | POST JSON on cron analyze |
| `DISCORD_WEBHOOK_URL` | Optional Discord on cron |
| `DESK_ALERT_QUIET_HOURS` | Set `false` to disable BKK quiet hours |
| `OPENAI_API_KEY` | Optional desk narrator |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |

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
MVP 9 (operator hub)  →  MVP 7 (presets polish)  →  MVP 8 (deep LLM/backtest)
```

MVP 9 ships core pieces of MVP 7–8; remaining 7–8 scope is presets UI, calibration export, ETH correlation v2.

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
