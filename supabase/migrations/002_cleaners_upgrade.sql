-- ═══════════════════════════════════════════════════════════════
-- Aura Cleaners — Migración 002
-- Cleaners: foto, tarifa por hora y disponibilidad semanal.
-- Ejecutar en el SQL Editor de Supabase (después de schema.sql y seed.sql).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tarifa por hora por cleaner ─────────────────────────────
alter table public.cleaners
  add column if not exists hourly_rate numeric(8,2) not null default 35;

alter table public.cleaners
  add column if not exists notes text;

-- ── 2. Disponibilidad semanal por cleaner ──────────────────────
-- weekday: 0 = domingo … 6 = sábado
create table if not exists public.cleaner_availability (
  id          bigint generated always as identity primary key,
  cleaner_id  bigint not null references public.cleaners(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null default '09:00',
  end_time    time not null default '18:00',
  active      boolean not null default true,
  unique (cleaner_id, weekday)
);

create index if not exists cleaner_availability_cleaner_idx
  on public.cleaner_availability (cleaner_id);

alter table public.cleaner_availability enable row level security;

-- Lectura pública (el cotizador necesita saber qué horarios ofrece cada cleaner)
drop policy if exists "cleaner availability readable" on public.cleaner_availability;
create policy "cleaner availability readable" on public.cleaner_availability
  for select using (true);

-- Admins autenticados: control total
drop policy if exists "cleaner availability admin" on public.cleaner_availability;
create policy "cleaner availability admin" on public.cleaner_availability
  for all to authenticated using (true) with check (true);

-- ── 3. Disponibilidad por defecto (Lun–Sáb 9:00–18:00) ─────────
-- Se aplica a los cleaners que aún no tengan horarios definidos.
insert into public.cleaner_availability (cleaner_id, weekday, start_time, end_time, active)
select c.id, d.weekday, '09:00'::time, '18:00'::time, true
from public.cleaners c
cross join (select generate_series(1, 6) as weekday) d   -- 1=lunes … 6=sábado
on conflict (cleaner_id, weekday) do nothing;

-- Domingo cerrado por defecto
insert into public.cleaner_availability (cleaner_id, weekday, start_time, end_time, active)
select c.id, 0, '09:00'::time, '18:00'::time, false
from public.cleaners c
on conflict (cleaner_id, weekday) do nothing;

-- ── 4. Índice para detectar solapes rápido ─────────────────────
create index if not exists bookings_cleaner_date_idx
  on public.bookings (cleaner_id, service_date);

-- ── 5. Storage para fotos de cleaners ──────────────────────────
insert into storage.buckets (id, name, public)
values ('cleaner-avatars', 'cleaner-avatars', true)
on conflict (id) do nothing;

-- Lectura pública de las fotos
drop policy if exists "cleaner avatars public read" on storage.objects;
create policy "cleaner avatars public read" on storage.objects
  for select using (bucket_id = 'cleaner-avatars');

-- Solo admins autenticados pueden subir / reemplazar / borrar
drop policy if exists "cleaner avatars admin insert" on storage.objects;
create policy "cleaner avatars admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'cleaner-avatars');

drop policy if exists "cleaner avatars admin update" on storage.objects;
create policy "cleaner avatars admin update" on storage.objects
  for update to authenticated using (bucket_id = 'cleaner-avatars');

drop policy if exists "cleaner avatars admin delete" on storage.objects;
create policy "cleaner avatars admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'cleaner-avatars');
