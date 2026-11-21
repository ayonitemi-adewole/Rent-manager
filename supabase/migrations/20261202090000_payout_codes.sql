-- Phase 7: a WhatsApp code before a landlord changes their payout account.
--
-- Rent goes to whatever account is saved here, so replacing it is the one change worth stealing a
-- phone session for. The payout edge function now sends a 6-digit code to the landlord's WhatsApp
-- (the login_code template) and saves a different account only with that code. First-time setup
-- and re-confirming the same account need no code.
--
-- payout_codes        one row per landlord: the current code (hashed), the account it approves,
--                     tries left, and how many codes went out today. Service role only.
-- issue_payout_code() stores a new code: at most one a minute and 5 a day (WhatsApp charges per
--                     message). Returns 'ok', 'wait' or 'limit'.
-- check_payout_code() checks a code under a row lock, so parallel guesses can't beat the 5-try
--                     limit. Returns 'ok', 'wrong', 'locked', 'expired' or 'none'.

create table public.payout_codes (
  landlord_id uuid primary key references public.landlords (id) on delete cascade,
  -- HMAC of the code with the account it approves (supabase/functions/_shared/payout-code.ts).
  code_hash text not null,
  bank_code text not null,
  account_number text not null,
  sent_at timestamptz not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  -- Set once the account is saved: a code works once.
  used_at timestamptz,
  -- Codes sent on this Lagos day.
  sends_on date not null,
  sends int not null default 0
);

alter table public.payout_codes enable row level security;
revoke all on table public.payout_codes from public, anon, authenticated;

create or replace function public.issue_payout_code(
  p_landlord_id uuid,
  p_bank_code text,
  p_account_number text,
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  r public.payout_codes;
begin
  select * into r from public.payout_codes where landlord_id = p_landlord_id for update;
  if found then
    if r.used_at is null and r.sent_at > now() - interval '60 seconds' then
      return 'wait';
    end if;
    if r.sends_on = v_today and r.sends >= 5 then
      return 'limit';
    end if;
  end if;

  insert into public.payout_codes as c
    (landlord_id, code_hash, bank_code, account_number, sent_at, expires_at, attempts, used_at, sends_on, sends)
  values
    (p_landlord_id, p_code_hash, p_bank_code, p_account_number, now(), now() + interval '10 minutes', 0, null, v_today, 1)
  on conflict (landlord_id) do update set
    code_hash = excluded.code_hash,
    bank_code = excluded.bank_code,
    account_number = excluded.account_number,
    sent_at = excluded.sent_at,
    expires_at = excluded.expires_at,
    attempts = 0,
    used_at = null,
    sends = case when c.sends_on = v_today then c.sends + 1 else 1 end,
    sends_on = v_today;
  return 'ok';
end;
$$;

create or replace function public.check_payout_code(
  p_landlord_id uuid,
  p_bank_code text,
  p_account_number text,
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.payout_codes;
begin
  select * into r from public.payout_codes where landlord_id = p_landlord_id for update;
  -- No code, already used, or sent for a different account.
  if not found or r.used_at is not null or r.bank_code <> p_bank_code or r.account_number <> p_account_number then
    return 'none';
  end if;
  if r.attempts >= 5 then
    return 'locked';
  end if;
  if r.expires_at < now() then
    return 'expired';
  end if;
  if r.code_hash <> p_code_hash then
    update public.payout_codes set attempts = attempts + 1 where landlord_id = p_landlord_id;
    return case when r.attempts + 1 >= 5 then 'locked' else 'wrong' end;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.issue_payout_code(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.check_payout_code(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.issue_payout_code(uuid, text, text, text) to service_role;
grant execute on function public.check_payout_code(uuid, text, text, text) to service_role;
