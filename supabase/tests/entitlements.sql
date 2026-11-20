-- Plans and entitlements: data, defaults and who may do what. Read-only.
-- Run: npx supabase db query --remote --read-only -o table -f supabase/tests/entitlements.sql
--
-- The read-only role may not call landlord_entitlements() (only the server and SQL functions
-- may), so these check the data it reads, the permissions and the function definitions instead.
select test, case when ok then 'PASS' else 'FAIL' end as result
from (values
  ('the five plans are there',
    (select count(*) = 5 from public.plans
      where code in ('pilot', 'padi_free', 'padi', 'padi_plus', 'padi_pro'))),
  ('Padi Free: 5 units, 1% capped at ₦2,000, no WhatsApp reminders',
    exists (select 1 from public.plans where code = 'padi_free' and unit_limit = 5
      and platform_fee_bps = 100 and platform_fee_cap_kobo = 200000 and not whatsapp_reminders)),
  ('paid plans take no fee on rent',
    not exists (select 1 from public.plans where code in ('padi', 'padi_plus', 'padi_pro') and platform_fee_bps <> 0)),
  ('the default plan is set and exists',
    exists (select 1 from public.app_config c join public.plans p on p.code = c.value where c.key = 'default_plan')),
  ('the default plan (pilot) includes WhatsApp reminders and takes no fee',
    exists (select 1 from public.app_config c join public.plans p on p.code = c.value
      where c.key = 'default_plan' and p.whatsapp_reminders and p.platform_fee_bps = 0)),
  ('anyone can read plans (they are on the pricing page)',
    has_table_privilege('anon', 'public.plans', 'SELECT')),
  ('nobody but the server can change plans',
    not has_table_privilege('authenticated', 'public.plans', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.plans', 'INSERT')),
  ('landlords cannot give themselves a plan',
    not has_table_privilege('authenticated', 'public.landlord_subscriptions', 'INSERT')
    and not has_table_privilege('authenticated', 'public.landlord_subscriptions', 'UPDATE')),
  ('landlords can read their own entitlements',
    has_function_privilege('authenticated', 'public.my_entitlements()', 'EXECUTE')),
  ('but not anyone else''s',
    not has_function_privilege('authenticated', 'public.landlord_entitlements(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.landlord_entitlements(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.my_entitlements()', 'EXECUTE')),
  ('edge functions (service role) can read entitlements',
    has_function_privilege('service_role', 'public.landlord_entitlements(uuid)', 'EXECUTE')),
  ('the functions that call it run as its owner',
    (select bool_and(p.prosecdef and p.proowner = e.proowner)
       from pg_proc p, pg_proc e
      where e.oid = 'public.landlord_entitlements(uuid)'::regprocedure
        and p.oid in ('public.my_entitlements()'::regprocedure,
                      'public.queue_reminders()'::regprocedure,
                      'public.prepare_manual_reminder(uuid,uuid)'::regprocedure))),
  ('no active subscription falls back to the default plan',
    pg_get_functiondef('public.landlord_entitlements(uuid)'::regprocedure) like '%''trialing'', ''active'', ''grace''%'
    and pg_get_functiondef('public.landlord_entitlements(uuid)'::regprocedure) like '%default_plan%'),
  ('automatic WhatsApp reminders check the plan',
    pg_get_functiondef('public.queue_reminders()'::regprocedure) like '%landlord_entitlements%'),
  ('"send now" WhatsApp reminders check the plan',
    pg_get_functiondef('public.prepare_manual_reminder(uuid,uuid)'::regprocedure) like '%landlord_entitlements%')
) as t(test, ok);
