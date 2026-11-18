-- Phase 6: landlord onboarding.
--
-- Landlords now give an email (Flutterwave needs one; it replaces the made-up address),
-- may choose a name tenants see (e.g. "Adeyemi Properties"), and accept the terms and
-- privacy notice. Acceptance is stamped by the server in complete_onboarding().

-- ─────────────────────────── columns ────────────────────────────
alter table public.landlords
  add column display_name text check (display_name is null or length(btrim(display_name)) between 2 and 60),
  add column email text check (
    email is null or (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  add column terms_version text check (terms_version is null or length(terms_version) <= 20),
  add column terms_accepted_at timestamptz,
  -- What tenants see on reminders, receipts and their payment page.
  add column name_for_tenants text generated always as (coalesce(nullif(btrim(display_name), ''), full_name)) stored;

-- Landlords may edit their names and email. Payout and terms columns are written only by
-- the server (flw-payout, complete_onboarding). Rows are created only by complete_onboarding.
revoke update on public.landlords from authenticated;
grant update (id, full_name, display_name, email) on public.landlords to authenticated;
revoke insert on public.landlords from authenticated;

-- ───────────────────────── onboarding ───────────────────────────
-- Creates the signed-in user's landlord profile (or updates it, e.g. when terms change).
create or replace function public.complete_onboarding(
  p_full_name text,
  p_display_name text,
  p_email text,
  p_terms_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You are signed out. Please sign in again.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_terms_version), '') = '' then
    raise exception 'Please accept the terms and privacy notice.' using errcode = '23514';
  end if;

  insert into public.landlords as l (id, full_name, display_name, email, terms_version, terms_accepted_at)
  values (
    auth.uid(),
    btrim(p_full_name),
    nullif(btrim(p_display_name), ''),
    lower(btrim(p_email)),
    btrim(p_terms_version),
    now()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    display_name = excluded.display_name,
    email = excluded.email,
    terms_version = excluded.terms_version,
    terms_accepted_at = excluded.terms_accepted_at;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text) to authenticated;

-- ───────────── tenant-facing name everywhere tenants look ─────────────
-- Same bodies as 20261122090000_receipts.sql, with l.full_name → l.name_for_tenants.

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
      v_app_url || '/t/' || t.access_token, l.name_for_tenants
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
                           v_app_url || '/r/' || new.receipt_token, v_landlord.name_for_tenants)
  )
  on conflict (payment_id) where kind = 'receipt' do nothing;

  return null;
end;
$$;

revoke execute on function public.payments_issue_receipt() from public, anon, authenticated;

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
    'landlord_name', l.name_for_tenants,
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
    'landlord_name', l.name_for_tenants,
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
