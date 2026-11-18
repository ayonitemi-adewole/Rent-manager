-- Tenants can have a separate WhatsApp number (many people call on one line and use WhatsApp
-- on another). SMS reminders and receipts still go to `phone`; WhatsApp messages from the app
-- go to whatsapp_phone when set. International numbers are allowed (E.164).

alter table public.tenants
  add column whatsapp_phone text check (whatsapp_phone is null or whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$');

-- payment_overview: + tenant_whatsapp, where to send a receipt on WhatsApp.
-- (Recreated from 20261122090000_receipts.sql; new columns go at the end.)
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
  coalesce(t.whatsapp_phone, t.phone) as tenant_whatsapp
from public.payments pay
join public.rent_charges c on c.id = pay.charge_id
join public.tenants t on t.id = c.tenant_id
join public.units u on u.id = t.unit_id
join public.properties p on p.id = u.property_id;

revoke all on public.payment_overview from anon;
