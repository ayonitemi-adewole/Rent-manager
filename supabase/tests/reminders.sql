-- Pure-function tests for reminder timing and wording. Read-only.
-- Run:  npx supabase db query --remote --read-only -f supabase/tests/reminders.sql
-- Every row should have ok = true.

with kind_cases (name, due, today, expected) as (
  values
  ('30 days before', date '2026-12-31', date '2026-12-01', 'd30'),
  ('14 days before', date '2026-12-15', date '2026-12-01', 'd14'),
  ('7 days before', date '2026-12-08', date '2026-12-01', 'd7'),
  ('1 day before', date '2026-12-02', date '2026-12-01', 'd1'),
  ('due today: no reminder', date '2026-12-01', date '2026-12-01', null),
  ('1 day late', date '2026-11-30', date '2026-12-01', 'od1'),
  ('7 days late', date '2026-11-24', date '2026-12-01', 'od7'),
  ('14 days late', date '2026-11-17', date '2026-12-01', 'od14'),
  ('15 days late: stop', date '2026-11-16', date '2026-12-01', null),
  ('20 days before: nothing', date '2026-12-21', date '2026-12-01', null),
  ('across a year end', date '2027-01-07', date '2026-12-31', 'd7')
)
select name, public.reminder_kind(due, today) is not distinct from expected as ok,
       public.reminder_kind(due, today) as actual, expected
from kind_cases
union all
select 'message: before due',
  m = 'Hi Tola, your rent of N350,000 for Flat 2 is due 1 Dec. Pay securely: https://x.app/t/abc - Mr Adeyemi',
  m, null
from (select public.reminder_message('d7', 'Tola Bakare', 35000000, 'Flat 2', date '2026-12-01',
                                     'https://x.app/t/abc', 'Mr Adeyemi') as m) s
union all
select 'message: overdue, part paid balance with kobo',
  m = 'Hi Tola, your rent of N1,500.5 for Room 3 was due 24 Nov. Please pay: L - Mr A',
  m, null
from (select public.reminder_message('od7', 'Tola', 150050, 'Room 3', date '2026-11-24', 'L', 'Mr A') as m) s
union all
select 'message: due tomorrow',
  m like 'Hi Tola, your rent of N350,000 for Flat 2 is due tomorrow, 2 Dec.%',
  m, null
from (select public.reminder_message('d1', 'Tola', 35000000, 'Flat 2', date '2026-12-02', 'L', 'Mr A') as m) s;
