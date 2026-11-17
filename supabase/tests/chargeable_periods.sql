-- Pure-function tests for public.chargeable_periods. Read-only; touches no data.
-- Run:  npx supabase db query --linked -f supabase/tests/chargeable_periods.sql
-- Every row should have ok = true.

with cases (name, start_date, period, paid_until, added_on, moved_out_at, horizon, expected) as (
  values
  ('yearly: current period only, next is beyond horizon',
    date '2026-01-15', 'yearly'::public.rent_period, null::date, date '2026-11-18', null::date, date '2027-01-02',
    array[date '2026-01-15']),
  ('yearly: next period inside 45-day horizon is created',
    date '2026-01-15', 'yearly', null, date '2026-11-18', null, date '2027-01-20',
    array[date '2026-01-15', date '2027-01-15']),
  ('paid_until = last day covered skips that period',
    date '2026-01-15', 'yearly', date '2027-01-14', date '2026-11-18', null, date '2027-01-20',
    array[date '2027-01-15']),
  ('paid_until = expiry date (first unpaid day) gives the same result',
    date '2026-01-15', 'yearly', date '2027-01-15', date '2026-11-18', null, date '2027-01-20',
    array[date '2027-01-15']),
  ('monthly from Jan 31 clamps to month end without drifting',
    date '2026-01-31', 'monthly', null, date '2026-01-31', null, date '2026-05-01',
    array[date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30']),
  ('yearly from Feb 29 uses Feb 28 in non-leap years',
    date '2024-02-29', 'yearly', null, date '2024-02-29', null, date '2026-03-01',
    array[date '2024-02-29', date '2025-02-28', date '2026-02-28']),
  ('six-monthly',
    date '2026-01-01', 'six_monthly', null, date '2026-01-01', null, date '2027-01-01',
    array[date '2026-01-01', date '2026-07-01', date '2027-01-01']),
  ('no periods starting after move-out',
    date '2026-01-01', 'monthly', null, date '2026-01-01', date '2026-03-15', date '2026-12-31',
    array[date '2026-01-01', date '2026-02-01', date '2026-03-01']),
  ('paid_until in the past creates arrears',
    date '2023-06-01', 'yearly', date '2024-05-31', date '2026-11-18', null, date '2026-12-31',
    array[date '2024-06-01', date '2025-06-01', date '2026-06-01']),
  ('long-standing tenant, no paid_until: only the current period',
    date '2015-03-01', 'yearly', null, date '2026-11-18', null, date '2027-01-02',
    array[date '2026-03-01']),
  ('tenancy starting in the future, beyond horizon: nothing yet',
    date '2027-06-01', 'yearly', null, date '2026-11-18', null, date '2027-01-02',
    array[]::date[])
)
select
  c.name,
  coalesce(r.actual, array[]::date[]) = c.expected as ok,
  coalesce(r.actual, array[]::date[]) as actual,
  c.expected
from cases c
cross join lateral (
  select array_agg(cp.period_start order by cp.period_start) as actual
  from public.chargeable_periods(c.start_date, c.period, c.paid_until, c.added_on, c.moved_out_at, c.horizon) cp
) r
union all
select
  'period_end is the day before the next period_start',
  bool_and(cp.period_end = lead_start - 1),
  null, null
from (
  select period_end, lead(period_start) over (order by period_start) as lead_start
  from public.chargeable_periods(date '2026-01-31', 'monthly', null, date '2026-01-31', null, date '2026-12-31')
) cp
where lead_start is not null;
