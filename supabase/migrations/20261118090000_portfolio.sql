-- Phase 1: landlords, properties, units, tenants.
-- Ownership chain: auth.users → landlords → properties → units → tenants.
-- Every table has RLS; a landlord can only ever see or change their own rows.

-- ───────────────────────────── enums ─────────────────────────────
create type public.rent_period as enum ('monthly', 'six_monthly', 'yearly');
create type public.unit_type as enum ('room', 'self_contain', 'mini_flat', 'flat', 'duplex', 'shop', 'other');
create type public.tenant_status as enum ('active', 'moved_out');

-- ─────────────────────────── helpers ────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- URL-safe random token for the tenant's no-login page link (24 chars, 144 bits).
create or replace function public.random_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

-- ─────────────────────────── landlords ──────────────────────────
create table public.landlords (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 100),
  -- auth stores the phone without '+'; we keep E.164.
  phone text not null default ('+' || (auth.jwt() ->> 'phone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger landlords_updated_at before update on public.landlords
  for each row execute function public.set_updated_at();

alter table public.landlords enable row level security;

create policy "landlords: read own" on public.landlords
  for select to authenticated using (id = (select auth.uid()));
create policy "landlords: create own" on public.landlords
  for insert to authenticated with check (id = (select auth.uid()));
create policy "landlords: update own" on public.landlords
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ─────────────────────────── properties ─────────────────────────
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null default auth.uid() references public.landlords (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  address text check (address is null or length(address) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_landlord_id_idx on public.properties (landlord_id);
create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

alter table public.properties enable row level security;

create policy "properties: owner full access" on public.properties
  for all to authenticated
  using (landlord_id = (select auth.uid()))
  with check (landlord_id = (select auth.uid()));

-- ───────────────────────────── units ────────────────────────────
create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 50),
  unit_type public.unit_type not null default 'room',
  rent_amount_kobo bigint not null check (rent_amount_kobo >= 0),
  rent_period public.rent_period not null default 'yearly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, label)
);

create index units_property_id_idx on public.units (property_id);
create trigger units_updated_at before update on public.units
  for each row execute function public.set_updated_at();

alter table public.units enable row level security;

create policy "units: owner full access" on public.units
  for all to authenticated
  using (exists (
    select 1 from public.properties p
    where p.id = units.property_id and p.landlord_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.properties p
    where p.id = units.property_id and p.landlord_id = (select auth.uid())
  ));

-- ──────────────────────────── tenants ───────────────────────────
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  -- restrict: a unit with tenancy history can't be deleted (keeps the ledger intact).
  unit_id uuid not null references public.units (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 2 and 100),
  phone text not null check (phone ~ '^\+234[789][01][0-9]{8}$'),
  start_date date not null,
  -- Snapshot of the agreed rent; the unit's advertised rent can change later.
  rent_amount_kobo bigint not null check (rent_amount_kobo >= 0),
  rent_period public.rent_period not null,
  -- For tenants already mid-tenancy when added: rent is paid up to this date.
  paid_until date,
  status public.tenant_status not null default 'active',
  moved_out_at date,
  access_token text not null unique default public.random_token(),
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'moved_out') = (moved_out_at is not null)),
  check (paid_until is null or paid_until >= start_date)
);

-- One active tenant per unit.
create unique index tenants_one_active_per_unit on public.tenants (unit_id) where status = 'active';
create index tenants_unit_id_idx on public.tenants (unit_id);
create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;

create policy "tenants: owner full access" on public.tenants
  for all to authenticated
  using (exists (
    select 1 from public.units u
    join public.properties p on p.id = u.property_id
    where u.id = tenants.unit_id and p.landlord_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.units u
    join public.properties p on p.id = u.property_id
    where u.id = tenants.unit_id and p.landlord_id = (select auth.uid())
  ));

-- Anonymous visitors get nothing; tenant pages will use a token-checked RPC (Phase 5).
revoke all on public.landlords, public.properties, public.units, public.tenants from anon;
