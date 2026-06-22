create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  amount integer not null,
  currency text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.screenings (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  email text,
  provider text not null,
  confidence integer not null,
  report_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_stripe_session_id_idx
  on public.payments (stripe_session_id);

create index if not exists screenings_payment_id_idx
  on public.screenings (payment_id);

create index if not exists screenings_email_idx
  on public.screenings (email);
