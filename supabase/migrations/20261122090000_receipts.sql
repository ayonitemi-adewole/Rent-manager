-- Phase 5: receipts, receipt messages, tenant link reset.
--
-- Every payment gets a receipt number per landlord (RP-0001, RP-0002, …) and a secret receipt
-- link token. Numbers are assigned AFTER insert, so webhook replays (ON CONFLICT DO NOTHING)
-- never burn a number. A receipt SMS is queued in the same messages table as reminders.

-- ─────────────────────────── columns ────────────────────────────
alter table public.landlords add column receipt_seq int not null default 0;

alter table public.payments
  add column receipt_number text,
  add column receipt_token text not null unique default public.random_token();

-- Back-fill numbers for payments made before receipts existed, in date order per landlord.
with numbered as (
  select pay.id, p.landlord_id,
         row_number() over (partition by p.landlord_id order by pay.paid_at, pay.created_at) as n
  from public.payments pay
  join public.rent_charges c on c.id = pay.charge_id
  join public.tenants t on t.id = c.tenant_id
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
)
update public.payments pay
set receipt_number = 'RP-' || lpad(numbered.n::text, 4, '0')
from numbered
where numbered.id = pay.id;

update public.landlords l
set receipt_seq = coalesce((
  select count(*) from public.payments pay
  join public.rent_charges c on c.id = pay.charge_id
  join public.tenants t on t.id = c.tenant_id
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where p.landlord_id = l.id
), 0);

-- ─────────────── messages: reminders + receipts ────────────────
alter table public.reminders add column payment_id uuid references public.payments (id) on delete cascade;

alter table public.reminders drop constraint reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('d60', 'd30', 'd14', 'd7', 'd1', 'od1', 'od7', 'od14', 'receipt'));
alter table public.reminders add constraint reminders_receipt_has_payment
  check ((kind = 'receipt') = (payment_id is not null));

-- Reminders: once per charge and kind. Receipts: once per payment.
alter table public.reminders drop constraint reminders_charge_id_kind_key;
create unique index reminders_charge_kind_uq on public.reminders (charge_id, kind) where kind <> 'receipt';
create unique index reminders_receipt_uq on public.reminders (payment_id) where kind = 'receipt';

-- queue_reminders' ON CONFLICT must name the (now partial) unique index's predicate.
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
  on conflict (charge_id, kind) where kind <> 'receipt' do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function public.queue_reminders() from public, anon, authenticated;

/* "Hi Tola, we received N350,000 for Flat 2. Receipt RP-0007: <link> - Mr Adeyemi" */
create or replace function public.receipt_message(
  p_tenant_name text,
  p_amount_kobo bigint,
  p_unit_label text,
  p_receipt_number text,
  p_link text,
  p_landlord_name text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select format(
    'Hi %s, we received N%s for %s. Receipt %s: %s - %s',
    split_part(trim(p_tenant_name), ' ', 1),
    trim(to_char(p_amount_kobo / 100.0, 'FM999,999,999,990.99'), '.'),
    p_unit_label,
    p_receipt_number,
    p_link,
    p_landlord_name
  );
$$;

-- ─────────────── numbering + receipt message trigger ─────────────
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

  insert into public.reminders (charge_id, payment_id, kind, scheduled_for, to_phone, message)
  values (
    new.charge_id, new.id, 'receipt', public.today_lagos(), v_tenant.phone,
    public.receipt_message(v_tenant.full_name, new.amount_kobo, v_unit_label, v_number,
                           v_app_url || '/r/' || new.receipt_token, v_landlord.full_name)
  )
  on conflict (payment_id) where kind = 'receipt' do nothing;

  return null;
end;
$$;

revoke execute on function public.payments_issue_receipt() from public, anon, authenticated;

create trigger payments_issue_receipt
  after insert on public.payments
  for each row execute function public.payments_issue_receipt();

-- ─────────────────────────── receipt RPC ─────────────────────────
-- Public receipt by its secret token. Shows only what belongs on a receipt.
create or replace function public.receipt(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'receipt_number', pay.receipt_number,
    'amount_kobo', pay.amount_kobo,
    'method', pay.method,
    'paid_at', pay.paid_at,
    'voided', pay.voided_at is not null,
    'tenant_name', t.full_name,
    'unit_label', u.label,
    'property_name', p.name,
    'property_address', p.address,
    'landlord_name', l.full_name,
    'period_start', c.period_start,
    'period_end', c.period_end,
    'charge_amount_kobo', c.amount_kobo,
    -- Balance left on that period right after this payment (later payments not counted).
    'balance_after_kobo', c.amount_kobo - coalesce((
      select sum(o.amount_kobo) from public.payments o
      where o.charge_id = c.id and o.voided_at is null
        and (o.paid_at, o.created_at) <= (pay.paid_at, pay.created_at)
    ), 0)
  )
  from public.payments pay
  join public.rent_charges c on c.id = pay.charge_id
  join public.tenants t on t.id = c.tenant_id
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  where pay.receipt_token = p_token
    and length(p_token) >= 20;
$$;

grant execute on function public.receipt(text) to anon, authenticated;

-- ─────────────────── tenant portal: + receipts ───────────────────
create or replace function public.tenant_portal(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tenant_name', t.full_name,
    'unit_label', u.label,
    'property_name', p.name,
    'landlord_name', l.full_name,
    'payout_bank', l.bank_name,
    'payout_account_last4', right(l.account_number, 4),
    'can_pay_online', l.flw_subaccount_id is not null,
    'charges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', co.id,
        'period_start', co.period_start,
        'period_end', co.period_end,
        'due_date', co.due_date,
        'amount_kobo', co.amount_kobo,
        'amount_paid_kobo', co.amount_paid_kobo,
        'balance_kobo', co.balance_kobo,
        'status', co.status,
        'timing', co.timing,
        'days_until_due', co.days_until_due
      ) order by co.due_date)
      from public.charge_overview co
      where co.tenant_id = t.id and co.status <> 'cancelled'
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'receipt_number', pay.receipt_number,
        'receipt_token', pay.receipt_token,
        'amount_kobo', pay.amount_kobo,
        'paid_at', pay.paid_at
      ) order by pay.paid_at desc)
      from public.payments pay
      join public.rent_charges c2 on c2.id = pay.charge_id
      where c2.tenant_id = t.id and pay.voided_at is null
    ), '[]'::jsonb)
  )
  from public.tenants t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  join public.landlords l on l.id = p.landlord_id
  where t.access_token = p_token
    and length(p_token) >= 20;
$$;

grant execute on function public.tenant_portal(text) to anon, authenticated;

-- payment_overview: + receipt fields (recreated: columns are added at the end).
create or replace view public.payment_overview
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
  pay.void_reason,
  pay.receipt_number,
  pay.receipt_token,
  t.phone as tenant_phone
from public.payments pay
join public.rent_charges c on c.id = pay.charge_id
join public.tenants t on t.id = c.tenant_id
join public.units u on u.id = t.unit_id
join public.properties p on p.id = u.property_id;

revoke all on public.payment_overview from anon;

-- ───────────────────────── reset tenant link ─────────────────────
-- New secret link for a tenant; the old one stops working immediately.
create or replace function public.regenerate_tenant_link(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  update public.tenants t
  set access_token = public.random_token()
  from public.units u
  join public.properties p on p.id = u.property_id
  where t.id = p_tenant_id and u.id = t.unit_id and p.landlord_id = auth.uid()
  returning t.access_token into v_token;

  if v_token is null then
    raise exception 'Tenant not found.' using errcode = 'P0002';
  end if;
  return v_token;
end;
$$;

revoke execute on function public.regenerate_tenant_link(uuid) from public, anon;
grant execute on function public.regenerate_tenant_link(uuid) to authenticated;
