-- Monthly rent: start reminders 14 days before (a 30-day reminder would land right after
-- the previous month was paid). Six-monthly and yearly keep the 30-day reminder.

drop function if exists public.reminder_kind(date, date);

create or replace function public.reminder_kind(p_due date, p_today date, p_period public.rent_period default null)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_due - p_today
    when 30 then case when p_period = 'monthly' then null else 'd30' end
    when 14 then 'd14' when 7 then 'd7' when 1 then 'd1'
    when -1 then 'od1' when -7 then 'od7' when -14 then 'od14'
  end;
$$;

create or replace function public.queue_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.today_lagos();
  v_app_url text := coalesce((select value from public.app_config where key = 'app_url'), '');
  inserted int;
begin
  insert into public.reminders (charge_id, kind, scheduled_for, to_phone, message)
  select
    c.id,
    k.kind,
    v_today,
    t.phone,
    public.reminder_message(
      k.kind, t.full_name, c.amount_kobo - c.amount_paid_kobo, u.label, c.due_date,
      v_app_url || '/t/' || t.access_token, l.full_name
    )
  from public.rent_charges c
  join public.tenants t on t.id = c.tenant_id
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  cross join lateral (select public.reminder_kind(c.due_date, v_today, t.rent_period) as kind) k
  where k.kind is not null
    and c.status in ('unpaid', 'partially_paid')
    and c.amount_kobo > c.amount_paid_kobo
    and t.status = 'active'
    and t.reminders_enabled
  on conflict (charge_id, kind) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function public.queue_reminders() from public, anon, authenticated;
