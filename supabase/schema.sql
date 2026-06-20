-- ============================================================================
-- Relay CRM — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- AUTH MODEL
-- ----------
-- Authentication is handled by Next-Auth (not Supabase Auth), so the app
-- talks to Postgres using the SERVICE ROLE key from server-side code only.
-- The service role bypasses RLS, and every API route enforces authorization
-- in application code (session check + business-membership check).
--
-- RLS is left ENABLED with no permissive policies so that, if the anon/public
-- key were ever used by accident, no rows would be readable. Do not query
-- these tables with the anon key from the browser.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));

-- ---------------------------------------------------------------------------
-- Password reset tokens (drives the Resend-powered forgot-password flow)
-- ---------------------------------------------------------------------------
create table if not exists public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists prt_user_idx on public.password_reset_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Businesses + membership (multi-business support & switching)
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index if not exists bm_user_idx on public.business_members (user_id);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
-- status values:
--   cold_lead | hot_lead | outreach | contacted | in_pipeline | sold
--   | recurring | lost
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  company     text,
  title       text,
  status      text not null default 'cold_lead'
              check (status in ('cold_lead','hot_lead','outreach','contacted',
                                'in_pipeline','sold','recurring','lost')),
  source      text,
  value       numeric(12,2) default 0 check (value >= 0),
  notes       text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists customers_business_idx on public.customers (business_id);
create index if not exists customers_status_idx on public.customers (business_id, status);

-- ---------------------------------------------------------------------------
-- Contact logs (every interaction with a customer)
-- ---------------------------------------------------------------------------
-- type values: note | call | email | meeting | status_change
create table if not exists public.contact_logs (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  type        text not null default 'note'
              check (type in ('note','call','email','meeting','status_change')),
  subject     text,
  body        text,
  created_at  timestamptz not null default now()
);

create index if not exists logs_customer_idx on public.contact_logs (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Tasks / follow-up reminders (value-add feature)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  title       text not null,
  due_at      timestamptz,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_business_idx on public.tasks (business_id, done, due_at);

-- ---------------------------------------------------------------------------
-- Keep customers.updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch
  before update on public.customers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lock everything down (service role bypasses RLS; anon key sees nothing)
-- ---------------------------------------------------------------------------
alter table public.users                  enable row level security;
alter table public.password_reset_tokens  enable row level security;
alter table public.businesses             enable row level security;
alter table public.business_members       enable row level security;
alter table public.customers              enable row level security;
alter table public.contact_logs           enable row level security;
alter table public.tasks                  enable row level security;

-- ---------------------------------------------------------------------------
-- Idempotent constraint backfill (for databases created before the CHECKs
-- above were added). Safe to re-run.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_status_check') then
    alter table public.customers
      add constraint customers_status_check
      check (status in ('cold_lead','hot_lead','outreach','contacted',
                        'in_pipeline','sold','recurring','lost'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_value_check') then
    alter table public.customers
      add constraint customers_value_check check (value >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_logs_type_check') then
    alter table public.contact_logs
      add constraint contact_logs_type_check
      check (type in ('note','call','email','meeting','status_change'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'business_members_role_check') then
    alter table public.business_members
      add constraint business_members_role_check check (role in ('owner','member'));
  end if;
end $$;
