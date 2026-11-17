-- Phase 3: payouts and online payments (Flutterwave).
--
-- Money never touches RentPadi: each landlord gets a Flutterwave subaccount and tenant
-- payments settle straight into the landlord's bank account.
--
-- Flow:  tenant page → flw-checkout (payment_attempts row + Flutterwave link)
--        → Flutterwave → flw-webhook / flw-verify → verify with Flutterwave → record_payment()
-- record_payment() is the ONLY way a payment changes a charge, for every payment method.

-- ───────────────────────── landlord payout ──────────────────────
alter table public.landlords
  add column bank_code text,
  add column bank_name text,
  add column account_number text check (account_number is null or account_number ~ '^[0-9]{10}$'),
  add column account_name text,
  add column flw_subaccount_id text,         -- "RS_…", used when creating payments
  add column flw_subaccount_ref bigint,      -- numeric id, used to update the subaccount
  add column payout_updated_at timestamptz;

-- Payout details are written only by the flw-payout edge function (after Flutterwave has
-- confirmed the account name). Landlords may update their name and nothing else.
-- (id is included because PostgREST's upsert writes it in ON CONFLICT DO UPDATE; RLS pins it to auth.uid().)
revoke update on public.landlords from authenticated;
grant update (id, full_name) on public.landlords to authenticated;

-- Upsert from the app sends (id, full_name); allow inserting just those.
revoke insert on public.landlords from authenticated;
grant insert (id, full_name) on public.landlords to authenticated;

-- ─────────────────────────── payments ───────────────────────────
create type public.payment_method as enum ('link', 'cash', 'transfer');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.rent_charges (id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  method public.payment_method not null,
  -- Idempotency key: tx_ref for online payments; generated for manual ones.
  reference text not null unique,
  flw_transaction_id bigint unique,
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id),
  note text check (note is null or length(note) <= 300),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);

create index payments_charge_id_idx on public.payments (charge_id);
create index payments_paid_at_idx on public.payments (paid_at);

alter table public.payments enable row level security;

create policy "payments: owner can read" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.rent_charges c
    join public.tenants t on t.id = c.tenant_id
    join public.units u on u.id = t.unit_id
    join public.properties p on p.id = u.property_id
    where c.id = payments.charge_id and p.landlord_id = (select auth.uid())
  ));

revoke all on public.payments from anon;
revoke insert, update, delete on public.payments from authenticated;

-- ──────────────────────── payment attempts ──────────────────────
-- One row per Pay tap. Server-only (edge functions use the service role).
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.rent_charges (id) on delete restrict,
  tx_ref text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed')),
  flw_transaction_id bigint,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_attempts_charge_id_idx on public.payment_attempts (charge_id);
create trigger payment_attempts_updated_at before update on public.payment_attempts
  for each row execute function public.set_updated_at();

alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from anon, authenticated;

-- ───────────────────────── webhook events ───────────────────────
-- Raw log of everything Flutterwave sends: for debugging and safe replays. Server-only.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  external_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index webhook_events_external_idx on public.webhook_events (provider, external_id);

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;

-- Tenant terms changed → rebuild charges, but never delete a charge a tenant has started
-- paying (an attempt exists): the payment may still complete and must have a charge to land on.
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
      and not exists (select 1 from public.payment_attempts a where a.charge_id = c.id);
  end if;
  perform public.generate_tenant_charges(new.id);
  return null;
end;
$$;

-- ───────────────────────── record_payment ───────────────────────
-- Records a payment against a charge and updates the charge's paid amount and status.
-- Idempotent on p_reference: recording the same payment twice is a no-op.
-- Returns the payment id (existing one on a repeat).
create or replace function public.record_payment(
  p_charge_id uuid,
  p_amount_kobo bigint,
  p_method public.payment_method,
  p_reference text,
  p_flw_transaction_id bigint default null,
  p_paid_at timestamptz default now(),
  p_recorded_by uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_charge public.rent_charges%rowtype;
  v_payment_id uuid;
  v_paid bigint;
begin
  -- Lock the charge so concurrent payments (webhook + redirect) serialise.
  select * into v_charge from public.rent_charges where id = p_charge_id for update;
  if not found then
    raise exception 'charge % not found', p_charge_id using errcode = 'P0002';
  end if;
  if v_charge.status = 'cancelled' then
    raise exception 'charge % is cancelled', p_charge_id using errcode = 'P0001';
  end if;

  insert into public.payments (charge_id, amount_kobo, method, reference, flw_transaction_id, paid_at, recorded_by, note)
  values (p_charge_id, p_amount_kobo, p_method, p_reference, p_flw_transaction_id, p_paid_at, p_recorded_by, p_note)
  on conflict (reference) do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select id into v_payment_id from public.payments where reference = p_reference;
    return v_payment_id; -- already recorded
  end if;

  select coalesce(sum(amount_kobo), 0) into v_paid
  from public.payments
  where charge_id = p_charge_id and voided_at is null;

  update public.rent_charges
  set amount_paid_kobo = v_paid,
      status = case
        when v_paid >= v_charge.amount_kobo then 'paid'::public.charge_status
        when v_paid > 0 then 'partially_paid'::public.charge_status
        else 'unpaid'::public.charge_status
      end
  where id = p_charge_id;

  return v_payment_id;
end;
$$;

revoke execute on function public.record_payment(uuid, bigint, public.payment_method, text, bigint, timestamptz, uuid, text)
  from public, anon, authenticated;

-- ───────────────────────── tenant portal ────────────────────────
-- Everything the no-login tenant page shows, looked up by the tenant's secret link token.
-- Only returns data for that one tenant; never exposes ids of other tenants.
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
