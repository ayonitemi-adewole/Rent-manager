-- Week 2: rent charges.
--
-- One row per tenant per rent period. Rent is due at the START of each period (paid in advance).
-- Periods are always computed from the tenancy start date (period n = start + n × months), never
-- chained from the previous period, so a Jan 31 start gives Feb 28 → Mar 31 → Apr 30 (no drift).
--
-- Stored status is the PAYMENT state only (unpaid / partially_paid / paid / cancelled).
-- "Overdue" and "due soon" are derived from due_date vs today in the charge_overview view,
-- so they are always correct without a job having to flip them.

create extension if not exists pg_cron;

create type public.charge_status as enum ('unpaid', 'partially_paid', 'paid', 'cancelled');

-- ───────────────────────────── table ────────────────────────────
create table public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  charge_type text not null default 'rent' check (charge_type in ('rent')),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  amount_paid_kobo bigint not null default 0 check (amount_paid_kobo >= 0),
  status public.charge_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, charge_type, period_start),
  check (period_end >= period_start)
);

create index rent_charges_tenant_id_idx on public.rent_charges (tenant_id);
create index rent_charges_open_due_idx on public.rent_charges (due_date)
  where status in ('unpaid', 'partially_paid');
create trigger rent_charges_updated_at before update on public.rent_charges
  for each row execute function public.set_updated_at();

alter table public.rent_charges enable row level security;

-- Landlords can read their tenants' charges. Writes happen only through the
-- security-definer functions below (and, later, record_payment).
create policy "rent_charges: owner can read" on public.rent_charges
  for select to authenticated
  using (exists (
    select 1 from public.tenants t
    join public.units u on u.id = t.unit_id
    join public.properties p on p.id = u.property_id
    where t.id = rent_charges.tenant_id and p.landlord_id = (select auth.uid())
  ));

revoke all on public.rent_charges from anon;
revoke insert, update, delete on public.rent_charges from authenticated;

-- ───────────────────────── period maths ─────────────────────────
create or replace function public.rent_period_months(p public.rent_period)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p when 'monthly' then 1 when 'six_monthly' then 6 when 'yearly' then 12 end;
$$;

-- Lagos "today" (Supabase runs in UTC; Nigeria is UTC+1).
create or replace function public.today_lagos()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

/*
  The periods a tenant should be charged for, up to p_horizon (inclusive, by period_start).

  - p_paid_until set   → skip periods ending on or before it (already paid outside RentPadi).
                          Works whether the landlord enters the last day covered (31 Dec)
                          or the expiry date (1 Jan).
  - p_paid_until null  → assume periods that ended before the tenant was added were settled;
                          the period they were added in is the first one charged.
  - p_moved_out_at set → no periods starting after the move-out date.
*/
create or replace function public.chargeable_periods(
  p_start_date date,
  p_period public.rent_period,
  p_paid_until date,
  p_added_on date,
  p_moved_out_at date,
  p_horizon date
)
returns table (period_start date, period_end date)
language sql
immutable
set search_path = ''
as $$
  with months as (select public.rent_period_months(p_period) as m),
  periods as (
    select
      (p_start_date + make_interval(months => n * m))::date as period_start,
      (p_start_date + make_interval(months => (n + 1) * m))::date - 1 as period_end
    from months, generate_series(0, 1200) as n   -- 1200 months = 100 years: plenty
  )
  select period_start, period_end
  from periods
  where period_start <= p_horizon
    and period_end > coalesce(p_paid_until, p_added_on - 1)
    and (p_moved_out_at is null or period_start <= p_moved_out_at)
  order by period_start;
$$;

-- ─────────────────────── charge generation ──────────────────────
-- How far ahead to create charges: 45 days, so the 30-day reminder has a charge to point at.
create or replace function public.generate_tenant_charges(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted int;
begin
  insert into public.rent_charges (tenant_id, period_start, period_end, due_date, amount_kobo)
  select t.id, cp.period_start, cp.period_end, cp.period_start, t.rent_amount_kobo
  from public.tenants t
  cross join lateral public.chargeable_periods(
    t.start_date, t.rent_period, t.paid_until,
    (t.created_at at time zone 'Africa/Lagos')::date,
    t.moved_out_at,
    public.today_lagos() + 45
  ) cp
  where t.id = p_tenant_id
  on conflict (tenant_id, charge_type, period_start) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Daily job: top up charges for every active tenant.
create or replace function public.generate_all_charges()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int := 0;
  t record;
begin
  for t in select id from public.tenants where status = 'active' loop
    total := total + public.generate_tenant_charges(t.id);
  end loop;
  return total;
end;
$$;

-- When a tenant is added, or their terms change, rebuild the charges nobody has paid towards.
-- Charges with any payment are kept as they are (the ledger is never rewritten).
create or replace function public.tenants_sync_charges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.rent_charges
    where tenant_id = new.id and status = 'unpaid' and amount_paid_kobo = 0;
  end if;
  perform public.generate_tenant_charges(new.id);
  return null;
end;
$$;

create trigger tenants_sync_charges
  after insert or update of start_date, rent_period, rent_amount_kobo, paid_until, status, moved_out_at
  on public.tenants
  for each row execute function public.tenants_sync_charges();

-- Only the database itself (triggers, cron) may call these.
revoke execute on function public.generate_tenant_charges(uuid) from public, anon, authenticated;
revoke execute on function public.generate_all_charges() from public, anon, authenticated;
revoke execute on function public.tenants_sync_charges() from public, anon, authenticated;

-- Back-fill charges for tenants added before this migration.
select public.generate_all_charges();

-- 00:30 Lagos time daily (cron runs in UTC).
select cron.schedule('generate-rent-charges', '30 23 * * *', $$select public.generate_all_charges()$$);

-- ─────────────────────────── overview ───────────────────────────
-- Everything the dashboard and tenant pages need about a charge, with derived timing.
-- security_invoker: the caller's RLS applies, so landlords only see their own rows.
create view public.charge_overview
with (security_invoker = true)
as
select
  c.id,
  c.tenant_id,
  t.full_name as tenant_name,
  t.phone as tenant_phone,
  u.id as unit_id,
  u.label as unit_label,
  p.id as property_id,
  p.name as property_name,
  c.period_start,
  c.period_end,
  c.due_date,
  c.amount_kobo,
  c.amount_paid_kobo,
  c.amount_kobo - c.amount_paid_kobo as balance_kobo,
  c.status,
  (c.due_date - public.today_lagos()) as days_until_due,
  case
    when c.status in ('paid', 'cancelled') then c.status::text
    when c.due_date < public.today_lagos() then 'overdue'
    when c.due_date <= public.today_lagos() + 30 then 'due_soon'
    else 'upcoming'
  end as timing
from public.rent_charges c
join public.tenants t on t.id = c.tenant_id
join public.units u on u.id = t.unit_id
join public.properties p on p.id = u.property_id;

revoke all on public.charge_overview from anon;
