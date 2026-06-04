-- Decision log sync from browser desk (MVP 6)

create table if not exists public.decision_log_entries (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  logged_at timestamptz not null,
  btc_price numeric,
  market_regime text,
  final_verdict text not null,
  risk_veto boolean not null default false,
  top_reasons jsonb not null default '[]'::jsonb,
  action_plan text,
  outcome_status text not null default 'PENDING',
  paper_pnl numeric,
  reflection jsonb,
  resolution jsonb,
  replay_snapshot jsonb,
  agent_outputs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_log_logged_at_idx
  on public.decision_log_entries (logged_at desc);

create index if not exists decision_log_outcome_idx
  on public.decision_log_entries (outcome_status);

comment on table public.decision_log_entries is
  'Synced decision log from AI trading desk — analysis only.';
