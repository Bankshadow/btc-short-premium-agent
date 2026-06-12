# MVP 22 — AI Trading Desk Terminal UX

Paper-only unified command center aggregating existing MVP modules.

## Route

- **UI:** `/terminal`
- **API:** `GET /api/terminal/bundle`, `POST /api/terminal/refresh` (Polymarket paper scan only)

## Safety

- No wallet signing, no private keys, no real orders
- `realTradingEnabled: false` hard-coded in bundle + schema tests
- Config panel read-only; kill switch changes via `/operator`

## Sections

1. Command Center  
2. Market Data Monitor (funding simulated)  
3. Polymarket Mispricing  
4. Sweeper Scanner  
5. Agent Debate Console  
6. Risk Guard  
7. Paper Execution Blotter  
8. Decision Journal  
9. System Health  
10. Config / Kill Switch Panel  

## Module layout

```
src/lib/terminal/
  terminal-types.ts
  terminal-mappers.ts
  terminal-projection-builder.ts
  mock-funding.ts
  terminal-bundle-schema.test.ts

src/components/terminal/
  TerminalDataTable.tsx
  terminal-sections.tsx

src/app/terminal/
  page.tsx
  terminal-client.tsx
```

## Tests

```bash
npx tsx --test src/lib/terminal/terminal-bundle-schema.test.ts
```

## Inspiration

FinceptTerminal used for **product/layout inspiration only** — no AGPL code imported.
