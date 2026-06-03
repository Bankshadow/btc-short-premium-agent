-- Analysis journal for cron / automated runs
-- Run in Supabase SQL Editor or via supabase db push

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  btc_price numeric,
  verdict text not null,
  confidence text not null,
  top_reasons jsonb not null default '[]'::jsonb,
  action_summary text,
  liquidation24h numeric,
  iv_hv_ratio numeric,
  sd_distance numeric,
  delta numeric,
  raw_result jsonb not null
);

create index if not exists analysis_runs_created_at_idx
  on public.analysis_runs (created_at desc);

comment on table public.analysis_runs is
  'BTC Short Premium Agent — analysis-only cron run history (no orders).';
