-- ═══════════════════════════════════════════════════════════════
-- Aura Cleaners — Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────
do $$ begin
  create type residence_type as enum ('residential', 'comercial', 'airbnb');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_type as enum ('standard', 'deep', 'move_in_out', 'general', 'addons');
exception when duplicate_object then null; end $$;

do $$ begin
  create type frequency_type as enum ('one_time', 'monthly', 'biweekly', 'weekly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quote_status as enum ('draft', 'pending', 'converted', 'expired', 'request_quote');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'processing', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cleaner_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('active', 'paused', 'cancelled');
exception when duplicate_object then null; end $$;

-- ── clients ────────────────────────────────────────────────────
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  address     text,
  language    text not null default 'en' check (language in ('en','fr','es')),
  created_at  timestamptz not null default now()
);
create unique index if not exists clients_email_key on public.clients (lower(email));

-- ── cleaners ───────────────────────────────────────────────────
create table if not exists public.cleaners (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text,
  phone       text,
  status      cleaner_status not null default 'active',
  hire_date   date,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ── services (catálogo de precios) ─────────────────────────────
create table if not exists public.services (
  id               bigint generated always as identity primary key,
  type             service_type not null,       -- standard | deep | move_in_out | general | addons
  category         text,                          -- agrupador visual (bedrooms, bathrooms, etc.)
  code             text unique not null,          -- clave estable usada por el cotizador
  name_en          text not null,
  name_fr          text not null,
  name_es          text not null,
  estimated_hours  numeric(5,2) not null default 0,
  price_per_hour   numeric(8,2) not null default 35,
  flat_price       numeric(8,2),                  -- si tiene precio fijo (ej. ventanas $35)
  is_request_quote boolean not null default false,
  active           boolean not null default true,
  sort_order       int not null default 0
);

-- ── quotes ─────────────────────────────────────────────────────
create table if not exists public.quotes (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete set null,
  cleaner_id       bigint references public.cleaners(id) on delete set null,
  residence_type   residence_type not null,
  service_type     service_type not null,
  rooms_factor     numeric(4,2) not null default 1,
  is_first_service boolean not null default false,
  frequency        frequency_type not null default 'one_time',
  services_json    jsonb not null default '[]'::jsonb,  -- [{code, name, hours, qty, line_total}]
  addons_json      jsonb not null default '[]'::jsonb,
  subtotal         numeric(10,2) not null default 0,
  discount_amount  numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  status           quote_status not null default 'pending',
  language         text not null default 'en',
  created_at       timestamptz not null default now(),
  valid_until      timestamptz not null default (now() + interval '14 days')
);

-- ── bookings ───────────────────────────────────────────────────
create table if not exists public.bookings (
  id                       uuid primary key default gen_random_uuid(),
  quote_id                 uuid references public.quotes(id) on delete set null,
  client_id                uuid references public.clients(id) on delete set null,
  cleaner_id               bigint references public.cleaners(id) on delete set null,
  service_date             date not null,
  service_time             time not null,
  duration_hours           numeric(5,2) not null default 0,
  address                  text,
  status                   booking_status not null default 'pending_payment',
  payment_40_intent_id     text,
  payment_40_amount        numeric(10,2),
  payment_40_status        payment_status not null default 'pending',
  payment_60_intent_id     text,
  payment_60_amount        numeric(10,2),
  payment_60_status        payment_status not null default 'pending',
  google_calendar_event_id text,
  notes                    text,
  created_at               timestamptz not null default now()
);
create index if not exists bookings_service_date_idx on public.bookings (service_date);
create index if not exists bookings_status_idx on public.bookings (status);

-- ── subscriptions ──────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid references public.bookings(id) on delete set null,
  client_id              uuid references public.clients(id) on delete set null,
  stripe_subscription_id text,
  frequency              frequency_type not null,
  next_date              date,
  status                 subscription_status not null default 'active',
  created_at             timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security
-- El acceso público se hace únicamente vía service_role (server-side).
-- El dashboard admin usa usuarios autenticados de Supabase Auth.
-- ═══════════════════════════════════════════════════════════════
alter table public.clients       enable row level security;
alter table public.cleaners      enable row level security;
alter table public.services      enable row level security;
alter table public.quotes        enable row level security;
alter table public.bookings      enable row level security;
alter table public.subscriptions enable row level security;

-- Servicios: lectura pública (el cotizador los necesita para precios)
drop policy if exists "services readable by anon" on public.services;
create policy "services readable by anon" on public.services
  for select using (active = true);

-- Cleaners activos: lectura pública (para mostrar disponibilidad)
drop policy if exists "active cleaners readable" on public.cleaners;
create policy "active cleaners readable" on public.cleaners
  for select using (status = 'active');

-- Usuarios autenticados (admins) pueden hacer todo en todas las tablas.
do $$
declare t text;
begin
  foreach t in array array['clients','cleaners','services','quotes','bookings','subscriptions']
  loop
    execute format('drop policy if exists "authenticated full access" on public.%I;', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all
         to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- service_role bypassa RLS automáticamente; no requiere políticas.
