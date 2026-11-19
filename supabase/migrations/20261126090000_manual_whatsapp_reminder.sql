-- Phase 7: landlords send a WhatsApp reminder on demand, from RentPadi's WhatsApp number
-- (the send-reminder-now function), instead of only opening WhatsApp on their own phone.
--
-- Manual reminders are ordinary rows in public.reminders with kind 'manual', so they show up in
-- the tenant's reminder list and get delivery failures from wa-webhook like any other.

-- ───────────────────────── 'manual' kind ─────────────────────────
alter table public.reminders drop constraint reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('d60', 'd30', 'd14', 'd7', 'd1', 'od1', 'od7', 'od14', 'receipt', 'manual'));

-- Automatic reminders stay once per charge, kind and channel; manual ones can repeat
-- (prepare_manual_reminder limits them instead).
drop index public.reminders_charge_kind_channel_uq;
create unique index reminders_charge_kind_channel_uq
  on public.reminders (charge_id, kind, channel) where kind not in ('receipt', 'manual');

-- queue_reminders' ON CONFLICT must repeat the index's predicate. Otherwise unchanged.
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
  insert into public.reminders (charge_id, kind, channel, scheduled_for, to_phone, message)
  select
    c.id,
    k.kind,
    ch.channel,
    v_today,
    case ch.channel when 'whatsapp' then coalesce(t.whatsapp_phone, t.phone) else t.phone end,
    public.reminder_message(
      k.kind, t.full_name, c.amount_kobo - c.amount_paid_kobo, u.label, c.due_date,
      v_app_url || '/t/' || t.access_token, l.name_for_tenants
    )
  from public.rent_charges c
  join public.tenants t on t.id = c.tenant_id
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  cross join lateral (select public.reminder_kind(c.due_date, v_today, t.rent_period) as kind) k
  cross join lateral unnest(
    case when l.whatsapp_reminders then array['sms', 'whatsapp'] else array['sms'] end
  ) as ch(channel)
  where k.kind is not null
    and c.status in ('unpaid', 'partially_paid')
    and c.amount_kobo > c.amount_paid_kobo
    and t.status = 'active'
    and t.reminders_enabled
  on conflict (charge_id, kind, channel) where kind not in ('receipt', 'manual') do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function public.queue_reminders() from public, anon, authenticated;

-- ─────────────────────── manual reminder ───────────────────────
-- Called by send-reminder-now (service role) after it has checked who the landlord is.
-- Picks the tenant's earliest unpaid rent (rent is paid in order), records the reminder as
-- 'sending' and returns what the WhatsApp template needs (same shape as claim_outbound_messages).
-- Errors are raised with messages safe to show the landlord.
create or replace function public.prepare_manual_reminder(p_landlord_id uuid, p_tenant_id uuid)
returns table (
  id uuid,
  channel text,
  kind text,
  to_phone text,
  message text,
  tenant_id uuid,
  tenant_name text,
  unit_label text,
  balance_kobo bigint,
  due_date date,
  landlord_name text,
  access_token text,
  receipt_number text,
  receipt_token text,
  payment_amount_kobo bigint
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := public.today_lagos();
  v_app_url text := coalesce((select value from public.app_config where key = 'app_url'), '');
  t record;
  c record;
  v_last timestamptz;
  v_id uuid;
begin
  select te.id, te.full_name, te.phone, te.whatsapp_phone, te.access_token, te.status,
         u.label as unit_label, l.name_for_tenants
  into t
  from public.tenants te
  join public.units u on u.id = te.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  where te.id = p_tenant_id and p.landlord_id = p_landlord_id;

  if not found then
    raise exception 'Tenant not found.';
  end if;
  if t.status <> 'active' then
    raise exception 'This tenant has moved out.';
  end if;

  select rc.id, rc.due_date, (rc.amount_kobo - rc.amount_paid_kobo)::bigint as balance
  into c
  from public.rent_charges rc
  where rc.tenant_id = t.id
    and rc.status in ('unpaid', 'partially_paid')
    and rc.amount_kobo > rc.amount_paid_kobo
  order by rc.due_date
  limit 1;

  if not found then
    raise exception 'Nothing is owed right now, so there''s nothing to remind them about.';
  end if;

  -- At most one manual WhatsApp reminder per tenant every 12 hours (each one costs money,
  -- and repeated nudges annoy tenants). Failed attempts don't count.
  select max(r.created_at) into v_last
  from public.reminders r
  join public.rent_charges rc on rc.id = r.charge_id
  where rc.tenant_id = t.id and r.kind = 'manual' and r.channel = 'whatsapp'
    and r.status in ('sending', 'sent')
    and r.created_at > now() - interval '12 hours';

  if v_last is not null then
    raise exception 'You already sent % a WhatsApp reminder at %. You can send another after %.',
      split_part(trim(t.full_name), ' ', 1),
      to_char(v_last at time zone 'Africa/Lagos', 'FMHH12:MI am'),
      to_char((v_last + interval '12 hours') at time zone 'Africa/Lagos', 'FMHH12:MI am');
  end if;

  insert into public.reminders (charge_id, kind, channel, scheduled_for, to_phone, message, status, attempted_at)
  values (
    c.id, 'manual', 'whatsapp', v_today, coalesce(t.whatsapp_phone, t.phone),
    public.reminder_message(
      case when c.due_date < v_today then 'od' else 'manual' end,
      t.full_name, c.balance, t.unit_label, c.due_date,
      v_app_url || '/t/' || t.access_token, t.name_for_tenants
    ),
    'sending', now()
  )
  returning reminders.id into v_id;

  return query
  select r.id, r.channel, r.kind, r.to_phone, r.message,
         t.id, t.full_name, t.unit_label, c.balance, c.due_date,
         t.name_for_tenants, t.access_token,
         null::text, null::text, null::bigint
  from public.reminders r
  where r.id = v_id;
end;
$$;

revoke execute on function public.prepare_manual_reminder(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_manual_reminder(uuid, uuid) to service_role;
