-- Phase 7: plans and entitlements (step 2 of the PRICING.md rollout).
--
-- plans                   the plans a landlord can be on: price, unit limit, RentPadi's fee on
--                         online rent, and what's included. Seeded below from PRICING.md.
-- landlord_subscriptions  a landlord's current plan (one row each). Written only by the server
--                         (billing comes later). No row, or a lapsed one, means the default plan.
-- app_config.default_plan the plan for landlords without an active subscription: 'pilot' now
--                         (everything included, no fee), 'padi_free' at launch.
-- landlord_entitlements() the ONE place that decides what a landlord gets. SQL (reminders),
--                         edge functions and the app (through my_entitlements()) all ask it.
--
-- First feature gated: WhatsApp reminders (automatic and "send now"). Everyone is on the pilot
-- plan, so nothing changes for anyone yet. WhatsApp receipts are not gated: every plan gets them.

-- ───────────────────────────── plans ─────────────────────────────
create table public.plans (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  monthly_price_kobo bigint not null check (monthly_price_kobo >= 0),
  yearly_price_kobo bigint not null check (yearly_price_kobo >= 0),
  unit_limit int check (unit_limit is null or unit_limit > 0),          -- null: no limit
  extra_unit_price_kobo bigint check (extra_unit_price_kobo is null or extra_unit_price_kobo >= 0),
                                                                         -- per unit over the limit, per month
  platform_fee_bps int not null default 0 check (platform_fee_bps between 0 and 10000),
                                                                         -- RentPadi's % of online rent, in basis points
  platform_fee_cap_kobo bigint check (platform_fee_cap_kobo is null or platform_fee_cap_kobo >= 0),
                                                                         -- per rent bill, not per payment
  whatsapp_reminders boolean not null default false,
  sms_reminders_per_bill int check (sms_reminders_per_bill is null or sms_reminders_per_bill >= 0),
                                                                         -- null: the full schedule
  branded_receipts boolean not null default false,
  custom_reminders boolean not null default false,
  documents boolean not null default false,
  full_reports boolean not null default false,
  caretakers int not null default 0 check (caretakers >= 0),
  sort_order int not null default 0
);

alter table public.plans enable row level security;
-- Plans are public information (they're on the pricing page).
create policy "plans: anyone can read" on public.plans for select to anon, authenticated using (true);
revoke insert, update, delete on public.plans from anon, authenticated;

insert into public.plans (
  code, name, monthly_price_kobo, yearly_price_kobo, unit_limit, extra_unit_price_kobo,
  platform_fee_bps, platform_fee_cap_kobo, whatsapp_reminders, sms_reminders_per_bill,
  branded_receipts, custom_reminders, documents, full_reports, caretakers, sort_order
) values
  -- Pilot: free while we test with founding landlords. Everything included.
  ('pilot',     'Pilot',          0,       0,        null, null,  0,   null,   true,  null, true,  true,  true,  true,  5, 0),
  ('padi_free', 'Padi Free',      0,       0,        5,    null,  100, 200000, false, 2,    false, false, false, false, 0, 1),
  ('padi',      'Padi',           240000,  2400000,  10,   null,  0,   null,   true,  null, true,  false, false, false, 0, 2),
  ('padi_plus', 'Padi Plus',      500000,  5000000,  25,   null,  0,   null,   true,  null, true,  true,  true,  true,  1, 3),
  ('padi_pro',  'Padi Pro',       1000000, 10000000, 50,   20000, 0,   null,   true,  null, true,  true,  true,  true,  5, 4);

-- ──────────────────────── default plan ───────────────────────────
insert into public.app_config (key, value) values ('default_plan', 'pilot')
on conflict (key) do nothing;

-- ─────────────────── landlord subscriptions ──────────────────────
create table public.landlord_subscriptions (
  landlord_id uuid primary key references public.landlords (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status text not null check (status in ('trialing', 'active', 'grace', 'lapsed', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  -- Founding landlords: Padi Plus free for 12 months, then half price for 12 (PRICING.md §6).
  founding boolean not null default false,
  discount_ends_at timestamptz,
  billing_method text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger landlord_subscriptions_updated_at before update on public.landlord_subscriptions
  for each row execute function public.set_updated_at();

alter table public.landlord_subscriptions enable row level security;
create policy "subscriptions: owner can read" on public.landlord_subscriptions
  for select to authenticated using (landlord_id = (select auth.uid()));
revoke all on public.landlord_subscriptions from anon;
revoke insert, update, delete on public.landlord_subscriptions from authenticated;

-- ─────────────────────── entitlements ────────────────────────────
-- What a landlord gets right now. Trialing, active and grace subscriptions count; anything else
-- (or none) falls back to app_config.default_plan, then to padi_free.
create function public.landlord_entitlements(p_landlord_id uuid)
returns table (
  plan_code text,
  plan_name text,
  subscription_status text,          -- 'none' when on the default plan
  current_period_end timestamptz,
  unit_limit int,
  extra_unit_price_kobo bigint,
  units_used int,
  platform_fee_bps int,
  platform_fee_cap_kobo bigint,
  whatsapp_reminders boolean,
  sms_reminders_per_bill int,
  branded_receipts boolean,
  custom_reminders boolean,
  documents boolean,
  full_reports boolean,
  caretakers int
)
language sql
stable
security definer
set search_path = ''
as $$
  with sub as (
    select s.plan_code, s.status, s.current_period_end
    from public.landlord_subscriptions s
    where s.landlord_id = p_landlord_id and s.status in ('trialing', 'active', 'grace')
  ),
  chosen as (
    select coalesce(
      (select sub.plan_code from sub),
      (select c.value from public.app_config c where c.key = 'default_plan' and exists (
        select 1 from public.plans p where p.code = c.value)),
      'padi_free'
    ) as code
  )
  select
    pl.code,
    pl.name,
    coalesce((select sub.status from sub), 'none'),
    (select sub.current_period_end from sub),
    pl.unit_limit,
    pl.extra_unit_price_kobo,
    (select count(*)::int
       from public.units u
       join public.properties p on p.id = u.property_id
      where p.landlord_id = p_landlord_id),
    pl.platform_fee_bps,
    pl.platform_fee_cap_kobo,
    pl.whatsapp_reminders,
    pl.sms_reminders_per_bill,
    pl.branded_receipts,
    pl.custom_reminders,
    pl.documents,
    pl.full_reports,
    pl.caretakers
  from public.plans pl
  join chosen on chosen.code = pl.code;
$$;

-- Server-side only (SQL, edge functions). The app uses my_entitlements().
revoke execute on function public.landlord_entitlements(uuid) from public, anon, authenticated;
grant execute on function public.landlord_entitlements(uuid) to service_role;

-- The signed-in landlord's own entitlements, for the app (same columns).
create function public.my_entitlements()
returns table (
  plan_code text,
  plan_name text,
  subscription_status text,
  current_period_end timestamptz,
  unit_limit int,
  extra_unit_price_kobo bigint,
  units_used int,
  platform_fee_bps int,
  platform_fee_cap_kobo bigint,
  whatsapp_reminders boolean,
  sms_reminders_per_bill int,
  branded_receipts boolean,
  custom_reminders boolean,
  documents boolean,
  full_reports boolean,
  caretakers int
)
language sql
stable
security definer
set search_path = ''
as $$ select * from public.landlord_entitlements((select auth.uid())) $$;

revoke execute on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- ─────────────── gate 1: WhatsApp reminders (automatic) ───────────
-- Unchanged from 20261126090000_manual_whatsapp_reminder.sql except: WhatsApp needs the
-- landlord's switch AND a plan that includes WhatsApp reminders.
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
  cross join lateral public.landlord_entitlements(l.id) e
  cross join lateral (select public.reminder_kind(c.due_date, v_today, t.rent_period) as kind) k
  cross join lateral unnest(
    case when l.whatsapp_reminders and e.whatsapp_reminders then array['sms', 'whatsapp'] else array['sms'] end
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

-- ─────────────── gate 1: WhatsApp reminders ("send now") ──────────
-- Unchanged from 20261126090000_manual_whatsapp_reminder.sql except the plan check.
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

  if not coalesce((select e.whatsapp_reminders from public.landlord_entitlements(p_landlord_id) e), false) then
    raise exception 'Sending WhatsApp reminders from RentPadi is included from the Padi plan. See Settings → Plan.';
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
