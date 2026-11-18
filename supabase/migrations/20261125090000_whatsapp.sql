-- Phase 7: WhatsApp (Meta Cloud API).
--
-- 1. Landlords can switch on WhatsApp reminders and receipts, sent alongside SMS.
--    Each message is one row in public.reminders per channel ('sms' | 'whatsapp').
-- 2. A sender edge function (send-reminders) runs every 5 minutes, claims queued rows and
--    delivers them: WhatsApp through Meta, SMS through Termii (each only once configured).
-- 3. Tenants chat with the RentPadi WhatsApp number (wa-webhook) and are recognised by the
--    number they message from.

-- ───────────────────────── landlord switch ─────────────────────────
alter table public.landlords add column whatsapp_reminders boolean not null default false;
grant update (whatsapp_reminders) on public.landlords to authenticated;

-- ─────────────────────── one message per channel ──────────────────────
drop index public.reminders_charge_kind_uq;
drop index public.reminders_receipt_uq;
create unique index reminders_charge_kind_channel_uq
  on public.reminders (charge_id, kind, channel) where kind <> 'receipt';
create unique index reminders_receipt_channel_uq
  on public.reminders (payment_id, channel) where kind = 'receipt';

-- 'sending': claimed by the sender, not yet confirmed.
alter table public.reminders drop constraint reminders_status_check;
alter table public.reminders add constraint reminders_status_check
  check (status in ('queued', 'sending', 'sent', 'failed', 'skipped'));
alter table public.reminders add column attempted_at timestamptz;
create index reminders_provider_message_id_idx on public.reminders (provider_message_id)
  where provider_message_id is not null;

-- Queue reminders: SMS always; WhatsApp too when the landlord has switched it on.
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
  on conflict (charge_id, kind, channel) where kind <> 'receipt' do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function public.queue_reminders() from public, anon, authenticated;

-- Receipts: number the payment, queue the SMS, and the WhatsApp receipt when switched on.
create or replace function public.payments_issue_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_landlord public.landlords%rowtype;
  v_tenant public.tenants%rowtype;
  v_unit_label text;
  v_number text;
  v_message text;
  v_app_url text := coalesce((select value from public.app_config where key = 'app_url'), '');
begin
  select t.* into v_tenant
  from public.rent_charges c join public.tenants t on t.id = c.tenant_id
  where c.id = new.charge_id;

  select u.label into v_unit_label from public.units u where u.id = v_tenant.unit_id;

  update public.landlords l
  set receipt_seq = l.receipt_seq + 1
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.id = v_tenant.unit_id and l.id = p.landlord_id
  returning l.* into v_landlord;

  v_number := 'RP-' || lpad(v_landlord.receipt_seq::text, 4, '0');

  update public.payments set receipt_number = v_number where id = new.id;

  v_message := public.receipt_message(v_tenant.full_name, new.amount_kobo, v_unit_label, v_number,
                                      v_app_url || '/r/' || new.receipt_token, v_landlord.name_for_tenants);

  insert into public.reminders (charge_id, payment_id, kind, channel, scheduled_for, to_phone, message)
  values (new.charge_id, new.id, 'receipt', 'sms', public.today_lagos(), v_tenant.phone, v_message)
  on conflict (payment_id, channel) where kind = 'receipt' do nothing;

  if v_landlord.whatsapp_reminders then
    insert into public.reminders (charge_id, payment_id, kind, channel, scheduled_for, to_phone, message)
    values (new.charge_id, new.id, 'receipt', 'whatsapp', public.today_lagos(),
            coalesce(v_tenant.whatsapp_phone, v_tenant.phone), v_message)
    on conflict (payment_id, channel) where kind = 'receipt' do nothing;
  end if;

  return null;
end;
$$;

revoke execute on function public.payments_issue_receipt() from public, anon, authenticated;

-- ────────────────────────── the sender ──────────────────────────
-- Claims up to p_limit messages for the given channels and returns what's needed to send them.
-- Rows are locked with SKIP LOCKED, so overlapping sender runs never send the same message.
-- Before claiming, it retires messages that no longer make sense to send.
create or replace function public.claim_outbound_messages(p_channels text[], p_limit int default 50)
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
  v_hour int := extract(hour from now() at time zone 'Africa/Lagos');
begin
  -- Queued before a sender existed, or stuck: too late to be useful.
  update public.reminders r set status = 'skipped', error = 'expired'
  where r.status = 'queued' and r.scheduled_for < v_today - 2;

  -- Rent paid (or cancelled) since the reminder was queued.
  update public.reminders r set status = 'skipped', error = 'already paid'
  from public.rent_charges c
  where r.status = 'queued' and r.kind <> 'receipt' and c.id = r.charge_id
    and (c.status in ('paid', 'cancelled') or c.amount_paid_kobo >= c.amount_kobo);

  -- Payment voided before its receipt went out.
  update public.reminders r set status = 'skipped', error = 'payment voided'
  from public.payments pay
  where r.status = 'queued' and r.kind = 'receipt' and pay.id = r.payment_id and pay.voided_at is not null;

  return query
  with picked as (
    select r.id
    from public.reminders r
    where r.channel = any (p_channels)
      and r.scheduled_for <= v_today
      and (r.status = 'queued' or (r.status = 'sending' and r.attempted_at < now() - interval '15 minutes'))
      -- Reminders only in the daytime (8am–8pm Lagos); receipts any time.
      and (r.kind = 'receipt' or v_hour between 8 and 19)
    order by r.created_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.reminders r
    set status = 'sending', attempted_at = now()
    from picked
    where r.id = picked.id
    returning r.id, r.channel, r.kind, r.to_phone, r.message, r.charge_id, r.payment_id
  )
  select
    cl.id, cl.channel, cl.kind, cl.to_phone, cl.message,
    t.id, t.full_name, u.label,
    (c.amount_kobo - c.amount_paid_kobo)::bigint, c.due_date,
    l.name_for_tenants, t.access_token,
    pay.receipt_number, pay.receipt_token, pay.amount_kobo::bigint
  from claimed cl
  join public.rent_charges c on c.id = cl.charge_id
  join public.tenants t on t.id = c.tenant_id
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  left join public.payments pay on pay.id = cl.payment_id;
end;
$$;

revoke execute on function public.claim_outbound_messages(text[], int) from public, anon, authenticated;
grant execute on function public.claim_outbound_messages(text[], int) to service_role;

-- Every 5 minutes, call the sender. Needs two Vault secrets (see README):
--   project_url             https://<ref>.supabase.co
--   message_sender_secret   same value as the function secret MESSAGE_SENDER_SECRET
-- Without them this does nothing.
create extension if not exists pg_net;

create or replace function public.run_message_sender()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'message_sender_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sender-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.run_message_sender() from public, anon, authenticated;

select cron.schedule('send-messages', '*/5 * * * *', $$select public.run_message_sender()$$);

-- ─────────────────────────── the chat bot ───────────────────────────
-- Active tenancies for the number a WhatsApp message came from (E.164).
create or replace function public.wa_tenancies(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'tenant_id', t.id,
    'access_token', t.access_token,
    'tenant_name', t.full_name,
    'unit_label', u.label,
    'property_name', p.name,
    'landlord_name', l.name_for_tenants
  ) order by t.created_at), '[]'::jsonb)
  from public.tenants t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  where t.status = 'active'
    and (t.phone = p_phone or t.whatsapp_phone = p_phone);
$$;

revoke execute on function public.wa_tenancies(text) from public, anon, authenticated;
grant execute on function public.wa_tenancies(text) to service_role;

-- Incoming WhatsApp message ids, so Meta's retries are answered once.
create table public.wa_inbound (
  message_id text primary key,
  from_phone text not null,
  received_at timestamptz not null default now()
);
alter table public.wa_inbound enable row level security;
revoke all on public.wa_inbound from anon, authenticated;
