-- Client performance dashboard: Postgres / Supabase schema
--
-- Security model
--   * A back-office job writes data with the service role key, which bypasses
--     row level security. That key never reaches a browser.
--   * Browsers hold only the publishable key plus the signed-in user's token.
--     They can READ rows for the clients their login belongs to, and nothing
--     else. There are no insert, update or delete policies for signed-in
--     users, so the dashboard is read-only by construction.
--   * Anonymous visitors get nothing.
--   * Views use security_invoker so they obey the same row level security.
--
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ tables
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  domain      text not null unique,
  site_name   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists sites_client_idx on public.sites(client_id);

-- Which login may see which client.
create table if not exists public.client_members (
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  primary key (user_id, client_id)
);

-- Studio staff see every client.
create table if not exists public.staff (
  user_id     uuid primary key references auth.users(id) on delete cascade
);

-- One row per audit run.
create table if not exists public.audits (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  run_date        date not null,
  incomplete      boolean not null default false,
  overall         int check (overall between 0 and 100),
  seo             int check (seo between 0 and 100),
  performance     int check (performance between 0 and 100),
  accessibility   int check (accessibility between 0 and 100),
  best_practices  int check (best_practices between 0 and 100),
  security        int check (security between 0 and 100),
  issues_count    int,
  response_ms     int,
  unique (site_id, run_date)
);

-- The plain-English action plan for an audit.
create table if not exists public.recommendations (
  id        uuid primary key default gen_random_uuid(),
  audit_id  uuid not null references public.audits(id) on delete cascade,
  position  int not null,
  pillar    text not null check (pillar in ('found', 'speed', 'trust')),
  kind      text not null check (kind in ('fix', 'opportunity')),
  severity  text not null check (severity in ('high', 'medium', 'low')),
  title     text not null,
  why       text,
  found     text
);
create index if not exists recs_audit_idx on public.recommendations(audit_id);

create table if not exists public.traffic_daily (
  site_id          uuid not null references public.sites(id) on delete cascade,
  day              date not null,
  visits           int not null default 0,
  unique_visitors  int not null default 0,
  primary key (site_id, day)
);

-- Daily rollup of the 5 minute uptime checks.
create table if not exists public.uptime_daily (
  site_id      uuid not null references public.sites(id) on delete cascade,
  day          date not null,
  checks       int not null,
  down_checks  int not null default 0,
  avg_ms       int,
  primary key (site_id, day)
);

create table if not exists public.keyword_ranks (
  site_id   uuid not null references public.sites(id) on delete cascade,
  run_date  date not null,
  keyword   text not null,
  position  int,            -- null = not in the top 50
  primary key (site_id, run_date, keyword)
);

create table if not exists public.work_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  done_on     date not null,
  title       text not null,
  detail      text,
  category    text not null check (category in ('seo', 'design', 'security', 'content', 'maintenance'))
);
create index if not exists work_client_idx on public.work_log(client_id, done_on desc);

-- ------------------------------------------------------------------ access helpers
-- security definer so the checks themselves are not blocked by RLS;
-- search_path is pinned so they cannot be hijacked.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function public.can_see_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or exists (select 1 from public.client_members
                 where user_id = auth.uid() and client_id = cid);
$$;

create or replace function public.can_see_site(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sites s
                 where s.id = sid and public.can_see_client(s.client_id));
$$;

-- ------------------------------------------------------------------ row level security
alter table public.clients         enable row level security;
alter table public.sites           enable row level security;
alter table public.client_members  enable row level security;
alter table public.staff           enable row level security;
alter table public.audits          enable row level security;
alter table public.recommendations enable row level security;
alter table public.traffic_daily   enable row level security;
alter table public.uptime_daily    enable row level security;
alter table public.keyword_ranks   enable row level security;
alter table public.work_log        enable row level security;

drop policy if exists read_clients on public.clients;
create policy read_clients on public.clients for select to authenticated
  using (public.can_see_client(id));

drop policy if exists read_sites on public.sites;
create policy read_sites on public.sites for select to authenticated
  using (public.can_see_client(client_id));

drop policy if exists read_membership on public.client_members;
create policy read_membership on public.client_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists read_staff on public.staff;
create policy read_staff on public.staff for select to authenticated
  using (user_id = auth.uid());

drop policy if exists read_audits on public.audits;
create policy read_audits on public.audits for select to authenticated
  using (public.can_see_site(site_id));

drop policy if exists read_recs on public.recommendations;
create policy read_recs on public.recommendations for select to authenticated
  using (exists (select 1 from public.audits a
                 where a.id = audit_id and public.can_see_site(a.site_id)));

drop policy if exists read_traffic on public.traffic_daily;
create policy read_traffic on public.traffic_daily for select to authenticated
  using (public.can_see_site(site_id));

drop policy if exists read_uptime on public.uptime_daily;
create policy read_uptime on public.uptime_daily for select to authenticated
  using (public.can_see_site(site_id));

drop policy if exists read_ranks on public.keyword_ranks;
create policy read_ranks on public.keyword_ranks for select to authenticated
  using (public.can_see_site(site_id));

drop policy if exists read_work on public.work_log;
create policy read_work on public.work_log for select to authenticated
  using (public.can_see_client(client_id));

revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;

-- ------------------------------------------------------------------ monthly views
-- The latest complete audit in each calendar month.
create or replace view public.monthly_scores with (security_invoker = true) as
select distinct on (site_id, date_trunc('month', run_date))
       site_id,
       date_trunc('month', run_date)::date as month,
       overall, seo, performance, accessibility, best_practices, security,
       issues_count, response_ms
from public.audits
where not incomplete
order by site_id, date_trunc('month', run_date), run_date desc;

create or replace view public.monthly_traffic with (security_invoker = true) as
select site_id,
       date_trunc('month', day)::date as month,
       sum(visits)::int          as visits,
       sum(unique_visitors)::int as unique_visitors,
       count(*)::int             as days_reported
from public.traffic_daily
group by site_id, date_trunc('month', day);

create or replace view public.monthly_uptime with (security_invoker = true) as
select site_id,
       date_trunc('month', day)::date as month,
       round(100.0 * (sum(checks) - sum(down_checks)) / nullif(sum(checks), 0), 1) as uptime_pct,
       round(avg(avg_ms))::int as avg_ms,
       sum(checks)::int        as checks
from public.uptime_daily
group by site_id, date_trunc('month', day);

-- The latest run each month, per keyword.
create or replace view public.monthly_ranks with (security_invoker = true) as
select distinct on (site_id, date_trunc('month', run_date), keyword)
       site_id,
       date_trunc('month', run_date)::date as month,
       keyword,
       position as best_position
from public.keyword_ranks
order by site_id, date_trunc('month', run_date), keyword, run_date desc;

-- The action plan from each site's most recent complete audit.
create or replace view public.latest_recommendations with (security_invoker = true) as
with latest as (
  select distinct on (site_id) id, site_id, run_date
  from public.audits
  where not incomplete
  order by site_id, run_date desc
)
select l.site_id,
       date_trunc('month', l.run_date)::date as month,
       r.position, r.pillar, r.kind, r.severity, r.title, r.why, r.found
from public.recommendations r
join latest l on l.id = r.audit_id;

grant select on public.monthly_scores, public.monthly_traffic, public.monthly_uptime,
                public.monthly_ranks, public.latest_recommendations to authenticated;
