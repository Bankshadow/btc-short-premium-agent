# Branch Strategy

## `main` — v1 prototype (reference only)

- Frozen prototype architecture from the first build.
- **Do not add new features** to v1 modules on `main`.
- Use for reference, evidence scripts, and historical context only.
- See `docs/V1_ARCHIVE_PLAN.md`, `docs/V2_ARCHITECTURE_BRIEF.md`.

## `v2-core` — clean minimal core (active development)

- Journal-first testnet operating loop.
- See [V2_ROADMAP.md](./V2_ROADMAP.md) for sprint plan (**Sprint 0–1 complete**).
- See [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md), [V2_EVENT_MODEL.md](./V2_EVENT_MODEL.md), [V2_SAFETY_RULES.md](./V2_SAFETY_RULES.md).
- **Live trading locked.** Testnet execute/close arrives Sprint 2+ with double confirmation.
- UI is thin — reads from APIs only; no duplicated mission/trade state.
- No advanced features until the core loop is stable.

### Switch branches

```bash
git checkout main      # v1 reference
git checkout v2-core   # v2 active core
```

### v1 WIP on main

Uncommitted v1 work was stashed before `v2-core` was created:

```bash
git checkout main
git stash list
git stash pop   # if you need the v1 WIP back
```
