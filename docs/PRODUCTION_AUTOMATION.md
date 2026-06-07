# Production automation — why it can look "idle"

## Root causes (Vercel Hobby)

1. **Cron every 15 minutes does not run on Hobby**
   - `vercel.json` schedules `*/15 * * * *` for `/api/cron/background-worker` and `/api/cron/desk-automation`.
   - Vercel **Hobby** allows cron **at most once per day**. Sub-daily schedules are ignored or never fire.
   - Docs already note: *"Vercel hobby plan may not run 15m cron reliably"* (`docs/FUNCTIONAL_SUMMARY.md`).

2. **No external scheduler was configured**
   - Until GitHub Actions is enabled (see below), nothing calls the server when the dashboard tab is closed.

3. **Ephemeral filesystem on Vercel**
   - Automation state, journal, and `lastCycleAt` are stored under `data/` via `JOURNAL_DATA_DIR` / `getCronDataDir()`.
   - Serverless functions do not persist local files across cold starts.
   - Even a successful manual run can show `lastCycleAt: null` on the next request.

4. **Market data was broken until Binance switch**
   - Bybit returned HTTP 403 on Vercel → analyze had `spotPrice=0` → desk SKIP every cycle.

5. **Telegram not configured**
   - `telegramConfigured: false` on production → no alerts when blockers occur.

## What actually runs automation

| Trigger | When |
|---------|------|
| GitHub Actions `.github/workflows/automation-cron.yml` | Every 15 min (after `CRON_SECRET` repo secret is set) |
| Vercel cron `/api/cron/background-worker` | Hobby: unreliable for `*/15`; use daily fallback only |
| Dashboard open + bootstrap | First visit runs one cycle if Binance connected |
| Manual POST `/api/automation/run` | Any time |

## Enable GitHub scheduler

1. GitHub repo → **Settings → Secrets and variables → Actions**
2. Add secret `CRON_SECRET` = same value as Vercel `CRON_SECRET`
3. Push `.github/workflows/automation-cron.yml` to `main`
4. **Actions** tab → run **Production automation cron** once manually to verify

## Persistent state (follow-up)

For `lastCycleAt`, journal history, and learning to survive overnight, configure one of:

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (warehouse/journal sync)
- `JOURNAL_DATA_DIR` on durable storage (Blob/KV — not yet wired in code)

Without this, cycles can **execute** but the UI may still look empty after cold starts.
