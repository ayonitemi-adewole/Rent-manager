-- Phase 4: manual payments (cash / transfer), voiding, payment overview, rent reminders.

-- ───────────────────────── app config ───────────────────────────
-- Server-side settings that SQL needs (e.g. links inside reminder messages).
create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values ('app_url', 'http://localhost:5173');

-- ─────────────────────── charge recompute ───────────────────────
-- Recalculate a charge's paid amount and status from its non-voided payments.
create or replace function public.refresh_charge_paid(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid bigint;
begin
  select coalesce(sum(amount_kobo), 0) into v_paid
  from public.payments
  where charge_id = p_charge_id and voided_at is null;

  update public.rent_charges
  set amount_paid_kobo = v_paid,
      status = case
        when status = 'cancelled' then status
        when v_paid >= amount_kobo then 'paid'::public.charge_status
        when v_paid > 0 then 'partially_paid'::public.charge_status
        else 'unpaid'::public.charge_status
      end
  where id = p_charge_id;
end;
$$;

revoke execute on function public.refresh_charge_paid(uuid) from public, anon, authenticated;

-- Never rebuild (delete) a charge that has any payment history, voided or not, or a
-- payment attempt: payments reference it and the ledger must stay intact.
create or replace function public.tenants_sync_charges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.rent_charges c
    where c.tenant_id = new.id
      and c.status = 'unpaid'
      and c.amount_paid_kobo = 0
      and not exists (select 1 from public.payment_attempts a where a.charge_id = c.id)
      and not exists (select 1 from public.payments p where p.charge_id = c.id);
  end if;
  perform public.generate_tenant_charges(new.id);
  return null;
end;
$$;

-- True when the signed-in user owns the charge (through tenant → unit → property).
create or replace function public.owns_charge(p_charge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rent_charges c
    join public.tenants t on t.id = c.tenant_id
    join public.units u on u.id = t.unit_id
    join public.properties p on p.id = u.property_id
    where c.id = p_charge_id and p.landlord_id = auth.uid()
  );
$$;

revoke execute on function public.owns_charge(uuid) from public, anon;
grant execute on function public.owns_charge(uuid) to authenticated; -- used by RLS policies

-- ───────────────────────── manual payment ───────────────────────
-- A landlord records cash or a direct transfer. Part payments allowed; overpaying is not.
create or replace function public.record_manual_payment(
  p_charge_id uuid,
  p_amount_kobo bigint,
  p_method public.payment_method,
  p_paid_on date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.rent_charges%rowtype;
begin
  if not public.owns_charge(p_charge_id) then
    raise exception 'Rent charge not found.' using errcode = 'P0002';
  end if;
  if p_method not in ('cash', 'transfer') then
    raise exception 'Only cash or transfer payments can be recorded by hand.' using errcode = '22023';
  end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'Enter an amount greater than zero.' using errcode = '22023';
  end if;
  if p_paid_on is null or p_paid_on > public.today_lagos() then
    raise exception 'The payment date cannot be in the future.' using errcode = '22023';
  end if;

  select * into v_charge from public.rent_charges where id = p_charge_id;
  if v_charge.status = 'cancelled' then
    raise exception 'This rent charge was cancelled.' using errcode = '22023';
  end if;
  if p_amount_kobo > v_charge.amount_kobo - v_charge.amount_paid_kobo then
    raise exception 'That is more than what is owed for this period.' using errcode = '22023';
  end if;

  return public.record_payment(
    p_charge_id,
    p_amount_kobo,
    p_method,
    'MAN-' || gen_random_uuid()::text,
    null,
    (p_paid_on::timestamp + time '12:00') at time zone 'Africa/Lagos',
    auth.uid(),
    nullif(trim(p_note), '')
  );
end;
$$;

revoke execute on function public.record_manual_payment(uuid, bigint, public.payment_method, date, text) from public, anon;
grant execute on function public.record_manual_payment(uuid, bigint, public.payment_method, date, text) to authenticated;

-- ─────────────────────────── void ───────────────────────────────
-- Mark a hand-recorded payment as a mistake. The row is kept (audit trail).
-- Online payments can't be voided here: those need a refund through Flutterwave.
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or not public.owns_charge(v_payment.charge_id) then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;
  if v_payment.method = 'link' then
    raise exception 'Online payments cannot be voided here.' using errcode = '22023';
  end if;
  if v_payment.voided_at is not null then
    return; -- already voided
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason for voiding this payment.' using errcode = '22023';
  end if;

  update public.payments
  set voided_at = now(), void_reason = trim(p_reason)
  where id = p_payment_id;

  perform public.refresh_charge_paid(v_payment.charge_id);
end;
$$;

revoke execute on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.void_payment(uuid, text) to authenticated;

-- ─────────────────────── payment overview ───────────────────────
create view public.payment_overview
with (security_invoker = true)
as
select
  pay.id,
  pay.charge_id,
  c.tenant_id,
  t.full_name as tenant_name,
  u.label as unit_label,
  p.name as property_name,
  c.period_start,
  c.period_end,
  pay.amount_kobo,
  pay.method,
  pay.paid_at,
  pay.note,
  pay.voided_at,
  pay.void_reason
from public.payments pay
join public.rent_charges c on c.id = pay.charge_id
join public.tenants t on t.id = c.tenant_id
join public.units u on u.id = t.unit_id
join public.properties p on p.id = u.property_id;

revoke all on public.payment_overview from anon;

-- ─────────────────────────── reminders ──────────────────────────
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.rent_charges (id) on delete cascade,
  kind text not null check (kind in ('d30', 'd14', 'd7', 'd1', 'od1', 'od7', 'od14')),
  channel text not null default 'sms' check (channel in ('sms', 'whatsapp')),
  scheduled_for date not null,
  to_phone text not null,
  message text not null,
  -- queued: waiting for the SMS sender (none configured yet) · sent · failed · skipped
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (charge_id, kind)
);

create index reminders_status_idx on public.reminders (status) where status = 'queued';

alter table public.reminders enable row level security;

create policy "reminders: owner can read" on public.reminders
  for select to authenticated
  using ((select public.owns_charge(charge_id)));

revoke all on public.reminders from anon;
revoke insert, update, delete on public.reminders from authenticated;

/* Which reminder (if any) is due today for a charge: 30/14/7/1 days before, 1/7/14 days late. */
create or replace function public.reminder_kind(p_due date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_due - p_today
    when 30 then 'd30' when 14 then 'd14' when 7 then 'd7' when 1 then 'd1'
    when -1 then 'od1' when -7 then 'od7' when -14 then 'od14'
  end;
$$;

/* The SMS text. Kept short: one 160-character segment where names allow. */
create or replace function public.reminder_message(
  p_kind text,
  p_tenant_name text,
  p_balance_kobo bigint,
  p_unit_label text,
  p_due date,
  p_link text,
  p_landlord_name text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select format(
    case
      when p_kind like 'od%' then 'Hi %s, your rent of N%s for %s was due %s. Please pay: %s - %s'
      when p_kind = 'd1' then 'Hi %s, your rent of N%s for %s is due tomorrow, %s. Pay: %s - %s'
      else 'Hi %s, your rent of N%s for %s is due %s. Pay securely: %s - %s'
    end,
    split_part(trim(p_tenant_name), ' ', 1),
    trim(to_char(p_balance_kobo / 100.0, 'FM999,999,999,990.99'), '.'),
    p_unit_label,
    to_char(p_due, 'FMDD Mon'),
    p_link,
    p_landlord_name
  );
$$;

-- Queue today's reminders. Idempotent (unique charge_id + kind): safe to run any number of times.
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
  cross join lateral (select public.reminder_kind(c.due_date, v_today) as kind) k
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

-- 09:00 Lagos (08:00 UTC), after the 00:30 charge generation.
select cron.schedule('queue-rent-reminders', '0 8 * * *', $$select public.queue_reminders()$$);
