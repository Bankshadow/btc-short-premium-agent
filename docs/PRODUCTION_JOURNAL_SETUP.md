# Production Journal Persistence (Vercel)

## Problem

On Vercel serverless, `/tmp` journal storage is **ephemeral** — data is lost on redeploy and cold starts.

## Solution

When blob credentials are available, the journal uses **Vercel Blob** (`@vercel/blob`) at pathname `v2-core/event-journal.json` (override with `JOURNAL_BLOB_PATHNAME`).

| Environment | Backend |
|-------------|---------|
| `BLOB_READ_WRITE_TOKEN` set | Vercel Blob (persistent) |
| Vercel + linked `BLOB_STORE_ID` | Vercel Blob via OIDC (persistent) |
| Local / `JOURNAL_DATA_DIR` | File (`data/event-journal.json`) |
| Vercel without blob credentials | File fallback `/tmp` (non-persistent) |

## Setup

1. Vercel Dashboard → Storage → Create Blob store
2. Link store to project (sets `BLOB_READ_WRITE_TOKEN` automatically)
3. Redeploy

## Verify

```bash
curl https://your-app.vercel.app/api/core/health
```

After trades, journal events persist across redeploys when blob backend is active.
