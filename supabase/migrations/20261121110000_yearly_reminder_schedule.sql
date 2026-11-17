-- Yearly rent: reminders start 60 days before the due date (60, 30, 14, 7, 1).
-- Monthly starts at 14 days; six-monthly at 30.
-- Charges must exist before the first reminder, so yearly charges are created 75 days ahead
-- (45 days for the others).

alter table public.reminders drop constraint reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('d60', 'd30', 'd14', 'd7', 'd1', 'od1', 'od7', 'od14'));

create or replace function public.reminder_kind(p_due date, p_today date, p_period public.rent_period default null)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_due - p_today
    when 60 then case when p_period = 'yearly' then 'd60' end
    when 30 then case when p_period = 'monthly' then null else 'd30' end
    when 14 then 'd14' when 7 then 'd7' when 1 then 'd1'
    when -1 then 'od1' when -7 then 'od7' when -14 then 'od14'
  end;
$$;

-- How many days ahead a tenant's next charge is created.
create or replace function public.charge_horizon_days(p_period public.rent_period)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_period when 'yearly' then 75 else 45 end;
$$;

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
    public.today_lagos() + public.charge_horizon_days(t.rent_period)
  ) cp
  where t.id = p_tenant_id
  on conflict (tenant_id, charge_type, period_start) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function public.generate_tenant_charges(uuid) from public, anon, authenticated;

-- Create any yearly charges that now fall inside the longer horizon.
select public.generate_all_charges();
