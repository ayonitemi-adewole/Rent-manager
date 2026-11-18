-- Landlord onboarding: who may write what. Read-only.
-- Run: npx supabase db query --remote --read-only -o table -f supabase/tests/onboarding.sql
select test, case when ok then 'PASS' else 'FAIL' end as result
from (values
  ('landlords can edit their email',
    has_column_privilege('authenticated', 'public.landlords', 'email', 'UPDATE')),
  ('landlords can edit the name tenants see',
    has_column_privilege('authenticated', 'public.landlords', 'display_name', 'UPDATE')),
  ('landlords cannot fake terms acceptance',
    not has_column_privilege('authenticated', 'public.landlords', 'terms_accepted_at', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.landlords', 'terms_version', 'UPDATE')),
  ('landlords cannot write payout details',
    not has_column_privilege('authenticated', 'public.landlords', 'flw_subaccount_id', 'UPDATE')),
  ('profiles are created only by complete_onboarding',
    not has_table_privilege('authenticated', 'public.landlords', 'INSERT')),
  ('signed-in users can complete onboarding',
    has_function_privilege('authenticated', 'public.complete_onboarding(text,text,text,text)', 'EXECUTE')),
  ('anonymous users cannot',
    not has_function_privilege('anon', 'public.complete_onboarding(text,text,text,text)', 'EXECUTE')),
  ('name tenants see falls back to the full name',
    not exists (select 1 from public.landlords where display_name is null and name_for_tenants <> full_name))
) as t(test, ok);
