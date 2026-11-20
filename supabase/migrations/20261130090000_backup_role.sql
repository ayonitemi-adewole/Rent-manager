-- Phase 6: a login for the nightly backup (.github/workflows/backup.yml).
--
-- backup_reader can read every table (pg_read_all_data) and skips row-level security, which
-- pg_dump needs to copy whole tables. It can't change data or the schema. The backup job uses it
-- instead of the postgres password, so the one credential GitHub holds can't write anything.
--
-- No password here (migrations are public). Set one once, in the SQL editor:
--   alter role backup_reader password '<long random password>';
-- then put the connection string in the BACKUP_DATABASE_URL GitHub secret (docs/BACKUPS.md).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'backup_reader') then
    create role backup_reader login bypassrls connection limit 2;
  end if;
end
$$;

grant pg_read_all_data to backup_reader;

-- Belt and braces: every transaction starts read-only. (The real limit is that the role has no
-- write privileges; this just stops accidents.)
alter role backup_reader set default_transaction_read_only = on;
-- A stuck dump shouldn't hold locks all night.
alter role backup_reader set statement_timeout = '10min';
alter role backup_reader set idle_in_transaction_session_timeout = '5min';
