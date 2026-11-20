-- Phase 7: record the fees on every online payment (step 1 of the PRICING.md rollout).
--
-- gateway_fee_kobo   what Paystack charged, read from Paystack's verify response. The landlord's
--                    share carries it (bearer: subaccount); tenants always pay exactly the rent.
-- platform_fee_kobo  what RentPadi kept. 0 during the pilot. It is decided per payment at checkout
--                    (stored on payment_attempts) from the landlord's plan at that moment, so the
--                    Padi Free fee (PRICING.md step 3) only changes what checkout writes there.
--
-- Both are null for cash and transfers recorded by hand, and for payments made before this
-- migration (Flutterwave never reported its fee to us).

-- ─────────────────────────── payments ───────────────────────────
alter table public.payments
  add column gateway_fee_kobo bigint check (gateway_fee_kobo is null or gateway_fee_kobo >= 0),
  add column platform_fee_kobo bigint check (platform_fee_kobo is null or platform_fee_kobo >= 0);

-- Fees come out of the rent paid, so together they can never exceed it.
alter table public.payments
  add constraint payments_fees_within_amount
  check (coalesce(gateway_fee_kobo, 0) + coalesce(platform_fee_kobo, 0) <= amount_kobo);

-- ──────────────────────── payment attempts ──────────────────────
-- RentPadi's fee for this checkout, fixed when the tenant taps Pay.
alter table public.payment_attempts
  add column platform_fee_kobo bigint not null default 0 check (platform_fee_kobo >= 0);

-- ───────────────────────── record_payment ───────────────────────
-- Same as 20261127090000_paystack.sql, plus the two fee parameters at the end (positional
-- callers such as record_manual_payment are unaffected).
drop function public.record_payment(uuid, bigint, public.payment_method, text, bigint, timestamptz, uuid, text, text);

create function public.record_payment(
  p_charge_id uuid,
  p_amount_kobo bigint,
  p_method public.payment_method,
  p_reference text,
  p_gateway_transaction_id bigint default null,
  p_paid_at timestamptz default now(),
  p_recorded_by uuid default null,
  p_note text default null,
  p_gateway text default null,
  p_gateway_fee_kobo bigint default null,
  p_platform_fee_kobo bigint default null
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

  insert into public.payments (
    charge_id, amount_kobo, method, reference, gateway, gateway_transaction_id,
    gateway_fee_kobo, platform_fee_kobo, paid_at, recorded_by, note
  )
  values (
    p_charge_id, p_amount_kobo, p_method, p_reference, p_gateway, p_gateway_transaction_id,
    p_gateway_fee_kobo, p_platform_fee_kobo, p_paid_at, p_recorded_by, p_note
  )
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

-- Server-only: edge functions (service role) and record_manual_payment (security definer).
revoke execute on function public.record_payment(
  uuid, bigint, public.payment_method, text, bigint, timestamptz, uuid, text, text, bigint, bigint
) from public, anon, authenticated;

-- ──────────────────────── payment_overview ──────────────────────
-- Unchanged from 20261124090000_tenant_whatsapp.sql, with the gateway and fees added at the end
-- (create or replace view can only append columns). Landlords only: tenants never see fees.
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
  t.phone as tenant_phone,
  coalesce(t.whatsapp_phone, t.phone) as tenant_whatsapp,
  pay.gateway,
  pay.gateway_fee_kobo,
  pay.platform_fee_kobo
from public.payments pay
join public.rent_charges c on c.id = pay.charge_id
join public.tenants t on t.id = c.tenant_id
join public.units u on u.id = t.unit_id
join public.properties p on p.id = u.property_id;
