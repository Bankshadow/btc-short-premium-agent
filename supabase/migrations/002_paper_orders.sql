-- Paper trading orders (hypothetical — synced from desk, no live exchange)

create table if not exists public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  decision_log_id text,
  committee_verdict text not null,
  instrument text not null,
  symbol text not null default 'BTCUSDT',
  side text not null default 'none',
  entry_btc_price numeric,
  entry_option_mark numeric,
  strike numeric,
  size_pct numeric not null default 0,
  notional_usd numeric,
  status text not null default 'OPEN',
  opened_at timestamptz not null,
  closed_at timestamptz,
  exit_btc_price numeric,
  realized_pnl_pct numeric,
  unrealized_pnl_pct numeric,
  last_mark_btc_price numeric,
  last_mark_at timestamptz,
  opened_by text not null default 'committee_auto',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paper_orders_status_idx
  on public.paper_orders (status, opened_at desc);

create index if not exists paper_orders_decision_log_idx
  on public.paper_orders (decision_log_id);

comment on table public.paper_orders is
  'Hypothetical paper orders from AI committee — analysis only, no exchange execution.';
