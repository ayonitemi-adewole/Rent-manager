-- Phase 7: online payments move from Flutterwave to Paystack.
--
-- Why: Flutterwave's Nigerian fee is an uncapped 2% (₦64,500 on a ₦3M rent). Paystack caps it
-- (₦2,000 + VAT on cards, less on transfers), and lets the landlord's subaccount carry the fee so
-- tenants pay exactly the rent. See docs/PRICING.md.
--
-- Money still never touches RentPadi: each landlord gets a Paystack subaccount (0% split to
-- RentPadi) and payments settle straight into their bank account.
--
-- Flow:  tenant page → pay-checkout (payment_attempts row + Paystack checkout)
--        → Paystack → pay-webhook / pay-verify → verify with Paystack → record_payment()
--
-- Landlords keep their bank details. They confirm them once (Settings → Payout account), which
-- creates their Paystack subaccount; until then their tenants can't pay online. Past Flutterwave
-- payments stay in the ledger, marked gateway = 'flutterwave'.

-- ───────────────────────── landlord payout ──────────────────────
alter table public.landlords
  add column paystack_subaccount_code text,  -- "ACCT_…", sent with every checkout
  add column paystack_subaccount_id bigint;  -- Paystack's numeric id, for support queries

-- Written only by the payout edge function (service role), like the other payout columns:
-- authenticated users only have UPDATE on (id, full_name, display_name, email).
alter table public.landlords
  drop column flw_subaccount_id,
  drop column flw_subaccount_ref;

-- ─────────────────────────── payments ───────────────────────────
-- Gateway-neutral columns: which company processed an online payment, and its id there.
alter table public.payments rename column flw_transaction_id to gateway_transaction_id;
alter table public.payments
  add column gateway text check (gateway in ('flutterwave', 'paystack'));

update public.payments set gateway = 'flutterwave' where method = 'link';

-- Online payments always name their gateway; cash and transfers never do.
alter table public.payments
  add constraint payments_gateway_matches_method check ((method = 'link') = (gateway is not null));

-- Transaction ids are only unique within one gateway.
alter table public.payments drop constraint if exists payments_flw_transaction_id_key;
alter table public.payments
  add constraint payments_gateway_transaction_key unique (gateway, gateway_transaction_id);

-- ──────────────────────── payment attempts ──────────────────────
alter table public.payment_attempts rename column flw_transaction_id to gateway_transaction_id;
-- Existing attempts were Flutterwave's; new ones are Paystack's.
alter table public.payment_attempts
  add column gateway text not null default 'flutterwave' check (gateway in ('flutterwave', 'paystack'));
alter table public.payment_attempts alter column gateway set default 'paystack';

-- ───────────────────────── record_payment ───────────────────────
-- Same behaviour as before (see 20261120090000_payments.sql); the gateway columns are renamed
-- and p_gateway is added at the end, so record_manual_payment's positional call still works.
drop function public.record_payment(uuid, bigint, public.payment_method, text, bigint, timestamptz, uuid, text);

create function public.record_payment(
  p_charge_id uuid,
  p_amount_kobo bigint,
  p_method public.payment_method,
  p_reference text,
  p_gateway_transaction_id bigint default null,
  p_paid_at timestamptz default now(),
  p_recorded_by uuid default null,
  p_note text default null,
  p_gateway text default null
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

  insert into public.payments
    (charge_id, amount_kobo, method, reference, gateway, gateway_transaction_id, paid_at, recorded_by, note)
  values
    (p_charge_id, p_amount_kobo, p_method, p_reference, p_gateway, p_gateway_transaction_id, p_paid_at, p_recorded_by, p_note)
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
revoke execute on function public.record_payment(uuid, bigint, public.payment_method, text, bigint, timestamptz, uuid, text, text)
  from public, anon, authenticated;

-- ───────────────────────── tenant portal ────────────────────────
-- Unchanged from 20261123090000_landlord_onboarding.sql except can_pay_online, which now means
-- "the landlord has a Paystack subaccount".
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
    'can_pay_online', l.paystack_subaccount_code is not null,
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
