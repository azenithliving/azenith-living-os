-- Canonical Schema for Azenith OS ∞
/*
-- Run in Supabase SQL Editor

-- Enable RLS on public schema
ALTER DATABASE current_setting('supabase.project_ref') OWNER TO postgres;
ALTER SCHEMA public ENABLE RLS;

-- companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  logo TEXT,
  primary_color TEXT DEFAULT '#C5A059',
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_created_at ON companies(created_at);

-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  session_id TEXT,
  score INTEGER DEFAULT 0,
  intent TEXT,
  last_page TEXT,
  room_type TEXT,
  budget TEXT,
  style TEXT,
  service_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_intent_score ON users(company_id, intent, score);

-- events (truncated for brevity; full in production)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_company_created ON events(company_id, created_at);
CREATE INDEX idx_events_company_type ON events(company_id, type, created_at);

-- Legacy note kept only inside commented history block.
-- Enable RLS policies after all tables

-- Example RLS policy (tenant isolation)
CREATE POLICY \"Companies can view own data\" ON companies FOR ALL USING (auth.role() = 'authenticated');
-- Full RLS after auth setup
*/

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'company_id')::uuid
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  logo text,
  primary_color text,
  whatsapp text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  session_id text not null,
  score integer not null default 0,
  intent text not null default 'browsing',
  last_page text,
  room_type text,
  budget text,
  style text,
  service_type text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  type text not null,
  value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  room_type text,
  budget text,
  style text,
  service_type text,
  status text not null default 'new',
  price numeric(12,2),
  paid boolean not null default false,
  quote_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  amount numeric(12,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null,
  slug text not null,
  title text not null,
  body text not null,
  performance_score numeric(10,2),
  ctr numeric(10,2),
  conversions integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  tags text[] not null default '{}',
  source text not null,
  license text,
  ctr numeric(10,2),
  conversions integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slug text not null,
  title text not null,
  status text not null default 'draft',
  seo_title text,
  seo_description text,
  og_image text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  type text not null,
  position integer not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  source text not null,
  license text,
  alt_text text,
  width integer,
  height integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  status text not null default 'draft',
  variants jsonb not null default '{}'::jsonb,
  winner text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  trigger text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_content_company_slug on public.content(company_id, slug);
create index if not exists idx_events_company_created_at on public.events(company_id, created_at);
create index if not exists idx_events_company_type_created_at on public.events(company_id, type, created_at);
create unique index if not exists idx_experiments_company_key on public.experiments(company_id, key);
create index if not exists idx_page_sections_company_page_position on public.page_sections(company_id, page_id, position);
create unique index if not exists idx_pages_company_slug on public.pages(company_id, slug);
create index if not exists idx_payments_company_created_at on public.payments(company_id, created_at);
create index if not exists idx_requests_company_status_created_at on public.requests(company_id, status, created_at);
create index if not exists idx_users_company_intent_score on public.users(company_id, intent, score);
create index if not exists idx_bookings_company_slot_start on public.bookings(company_id, slot_start);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at before update on public.requests
for each row execute function public.set_updated_at();

drop trigger if exists content_set_updated_at on public.content;
create trigger content_set_updated_at before update on public.content
for each row execute function public.set_updated_at();

drop trigger if exists images_set_updated_at on public.images;
create trigger images_set_updated_at before update on public.images
for each row execute function public.set_updated_at();

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at before update on public.pages
for each row execute function public.set_updated_at();

drop trigger if exists page_sections_set_updated_at on public.page_sections;
create trigger page_sections_set_updated_at before update on public.page_sections
for each row execute function public.set_updated_at();

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at before update on public.media_assets
for each row execute function public.set_updated_at();

drop trigger if exists experiments_set_updated_at on public.experiments;
create trigger experiments_set_updated_at before update on public.experiments
for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists automation_rules_set_updated_at on public.automation_rules;
create trigger automation_rules_set_updated_at before update on public.automation_rules
for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.events enable row level security;
alter table public.requests enable row level security;
alter table public.payments enable row level security;
alter table public.content enable row level security;
alter table public.images enable row level security;
alter table public.pages enable row level security;
alter table public.page_sections enable row level security;
alter table public.media_assets enable row level security;
alter table public.experiments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.bookings enable row level security;

drop policy if exists companies_isolation on public.companies;
create policy companies_isolation on public.companies
for all
using (id = public.current_company_id())
with check (id = public.current_company_id());

drop policy if exists users_isolation on public.users;
create policy users_isolation on public.users
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists events_isolation on public.events;
create policy events_isolation on public.events
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists requests_isolation on public.requests;
create policy requests_isolation on public.requests
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists payments_isolation on public.payments;
create policy payments_isolation on public.payments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists content_isolation on public.content;
create policy content_isolation on public.content
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists images_isolation on public.images;
create policy images_isolation on public.images
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists pages_isolation on public.pages;
create policy pages_isolation on public.pages
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists page_sections_isolation on public.page_sections;
create policy page_sections_isolation on public.page_sections
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists media_assets_isolation on public.media_assets;
create policy media_assets_isolation on public.media_assets
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists experiments_isolation on public.experiments;
create policy experiments_isolation on public.experiments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists audit_logs_isolation on public.audit_logs;
create policy audit_logs_isolation on public.audit_logs
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists bookings_isolation on public.bookings;
create policy bookings_isolation on public.bookings
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists automation_rules_isolation on public.automation_rules;
create policy automation_rules_isolation on public.automation_rules
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

