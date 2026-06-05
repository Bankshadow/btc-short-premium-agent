-- MVP 41: Production data warehouse — durable source of truth

create table if not exists public.decision_logs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  logged_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists decision_logs_logged_at_idx on public.decision_logs (logged_at desc);

create table if not exists public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  decision_log_id text not null,
  agent_name text not null,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_outputs_decision_idx on public.agent_outputs (decision_log_id);

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  status text not null default 'OPEN',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists paper_trades_recorded_idx on public.paper_trades (recorded_at desc);

create table if not exists public.live_trades (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_trades_recorded_idx on public.live_trades (recorded_at desc);

create table if not exists public.live_orders (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  live_trade_id text,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists live_orders_trade_idx on public.live_orders (live_trade_id);

create table if not exists public.execution_events (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  event_type text not null,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists execution_events_recorded_idx on public.execution_events (recorded_at desc);

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists market_snapshots_recorded_idx on public.market_snapshots (recorded_at desc);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  event_type text not null,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists risk_events_recorded_idx on public.risk_events (recorded_at desc);

create table if not exists public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  strategy_id text not null,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists strategy_versions_strategy_idx on public.strategy_versions (strategy_id);

create table if not exists public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  rule_id text,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.governance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists governance_audit_recorded_idx on public.governance_audit_logs (recorded_at desc);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  severity text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incidents_status_idx on public.incidents (status, severity);

create table if not exists public.command_center_status (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists command_center_recorded_idx on public.command_center_status (recorded_at desc);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_snapshots_recorded_idx on public.portfolio_snapshots (recorded_at desc);

create table if not exists public.learning_reports (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  recorded_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists learning_reports_recorded_idx on public.learning_reports (recorded_at desc);

create table if not exists public.warehouse_write_health (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  consecutive_failures int not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.decision_logs is 'MVP 41 warehouse — full decision log payload (source of truth).';
