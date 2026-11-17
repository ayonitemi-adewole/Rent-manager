-- Rent is paid in order: while an earlier period still has money owed, a later period can't
-- have a payment recorded or an online checkout started (flw-checkout checks the same rule).
-- Payments that already went through Flutterwave are always recorded (record_payment is
-- unchanged): money that has moved must land on its charge.

-- Due date of the earliest still-open charge of the same tenant that falls due BEFORE this
-- one, or null if there is none.
create or replace function public.earlier_open_charge_due(p_charge_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(e.due_date)
  from public.rent_charges c
  join public.rent_charges e on e.tenant_id = c.tenant_id
  where c.id = p_charge_id
    and e.id <> c.id
    and e.due_date < c.due_date
    and e.status in ('unpaid', 'partially_paid')
    and e.amount_kobo > e.amount_paid_kobo;
$$;

revoke execute on function public.earlier_open_charge_due(uuid) from public, anon, authenticated;

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
  v_earlier date;
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

  v_earlier := public.earlier_open_charge_due(p_charge_id);
  if v_earlier is not null then
    raise exception 'Record the earlier rent (due %) first.', to_char(v_earlier, 'FMDD Mon YYYY')
      using errcode = '22023';
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
