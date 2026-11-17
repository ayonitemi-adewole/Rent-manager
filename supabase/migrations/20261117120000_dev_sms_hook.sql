-- DEMO ONLY: "Send SMS" auth hook that stores OTP codes in a table instead of texting them.
-- Lets phone login work on hosted Supabase without an SMS provider.
-- Read codes in Dashboard → Table Editor → dev_sms_outbox.
--
-- Before the pilot: point the Send SMS hook at the Termii edge function instead,
-- then drop this table and function.

create table if not exists public.dev_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  otp text not null,
  created_at timestamptz not null default now()
);

-- Nobody but the auth service may touch it (no policies for anon/authenticated).
alter table public.dev_sms_outbox enable row level security;
revoke all on table public.dev_sms_outbox from anon, authenticated, public;
grant insert on table public.dev_sms_outbox to supabase_auth_admin;

create policy "auth service can insert"
  on public.dev_sms_outbox
  for insert
  to supabase_auth_admin
  with check (true);

create or replace function public.dev_send_sms_hook(event jsonb)
returns jsonb
language plpgsql
as $$
begin
  insert into public.dev_sms_outbox (phone, otp)
  values (event -> 'user' ->> 'phone', event -> 'sms' ->> 'otp');
  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.dev_send_sms_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.dev_send_sms_hook(jsonb) from authenticated, anon, public;
