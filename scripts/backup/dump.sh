#!/usr/bin/env bash
# Dumps RentPadi's database to plain SQL, for the nightly backup (.github/workflows/backup.yml).
#
#   BACKUP_DATABASE_URL=postgresql://backup_reader.<ref>:<password>@<pooler>:5432/postgres \
#     scripts/backup/dump.sh <out-dir>
#
# Writes to <out-dir>:
#   schema.sql   our tables, views, functions, policies and grants (not Supabase's own schemas)
#   data.sql     every row: app data, logins (auth), scheduled jobs (cron), migration history
#   counts.tsv   rows per table in data.sql, so a restore can be checked
#
# Modelled on `supabase db dump` (the same platform schemas left out, the same clean-ups), but it
# runs pg_dump directly with the read-only backup_reader login: no Docker, no write access.
# Needs pg_dump 17 (the database's major version). Prints no data: the repo is public, so are logs.
set -euo pipefail

out=${1:?usage: dump.sh <out-dir>}
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set}"
mkdir -p "$out"

# Supabase's own schemas: every new project has them, so a backup never restores them.
platform='information_schema|pg_*|_analytics|_realtime|_supavisor|etl|extensions|pgbouncer|realtime|supabase_functions|dbdev|graphql|graphql_public|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault'
# Structure that comes with the services (Auth, Storage, pg_cron, pg_net): only their rows are ours.
services='auth|storage|cron|net'

# ── Schema ──
# The sed lines turn CREATE into CREATE IF NOT EXISTS / OR REPLACE where a new project already has
# the object, and comment out what only Supabase may change (event triggers, platform grants...).
pg_dump --dbname="$BACKUP_DATABASE_URL" \
  --schema-only --quote-all-identifiers --no-owner \
  --exclude-schema="$platform|$services" \
  | sed -E 's/^\\(un)?restrict .*$/-- &/' \
  | sed -E 's/^CREATE SCHEMA "/CREATE SCHEMA IF NOT EXISTS "/' \
  | sed -E 's/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/' \
  | sed -E 's/^CREATE SEQUENCE "/CREATE SEQUENCE IF NOT EXISTS "/' \
  | sed -E 's/^CREATE VIEW "/CREATE OR REPLACE VIEW "/' \
  | sed -E 's/^CREATE FUNCTION "/CREATE OR REPLACE FUNCTION "/' \
  | sed -E 's/^CREATE TRIGGER "/CREATE OR REPLACE TRIGGER "/' \
  | sed -E 's/^CREATE PUBLICATION "supabase_realtime/-- &/' \
  | sed -E 's/^CREATE EVENT TRIGGER /-- &/' \
  | sed -E 's/^         WHEN TAG IN /-- &/' \
  | sed -E 's/^   EXECUTE FUNCTION /-- &/' \
  | sed -E 's/^ALTER EVENT TRIGGER /-- &/' \
  | sed -E 's/^ALTER PUBLICATION "supabase_realtime_/-- &/' \
  | sed -E 's/^ALTER FOREIGN DATA WRAPPER (.+) OWNER TO /-- &/' \
  | sed -E 's/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"/-- &/' \
  | sed -E 's/^GRANT ALL ON FOREIGN DATA WRAPPER (.+) TO "postgres" WITH GRANT OPTION/-- &/' \
  | sed -E "s/^(GRANT|REVOKE) (.+) ON (.+) \"($platform|$services)\"/-- &/" \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "(pg_tle|pgsodium|pgmq)").+/\1;/' \
  | sed -E 's/^COMMENT ON EXTENSION (.+)/-- &/' \
  | sed -E 's/^CREATE POLICY "cron_job_/-- &/' \
  | sed -E 's/^ALTER TABLE "cron"/-- &/' \
  | sed -E 's/^SET transaction_timeout = 0;/-- &/' \
  > "$out/schema.sql"

# ── Storage guard ──
# RentPadi doesn't use Supabase Storage, so its tables are left out of the data: they're the Storage
# service's own (only it may write them, so a restore can't load them anyway), and backing up file
# rows without the files would be useless. If buckets or files ever appear, stop and say so, rather
# than quietly not backing them up.
storage_rows=$(psql "$BACKUP_DATABASE_URL" --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command 'select (select count(*) from storage.buckets) + (select count(*) from storage.objects)')
if [ "$storage_rows" != "0" ]; then
  echo 'Supabase Storage now has buckets or files, which this backup does not cover. Extend dump.sh (and docs/BACKUPS.md) to back them up.' >&2
  exit 1
fi

# ── Data ──
# Left out: Storage (above), run logs and queues that are only useful for a few minutes, Supabase's
# own migration table, and the dev login-code outbox (codes are short-lived and shouldn't sit in backups).
{
  # Load rows exactly as they were: no triggers (no "updated_at" bumps, no reminders queued) and
  # no foreign-key checks while tables are filled in whatever order pg_dump chose.
  echo 'SET session_replication_role = replica;'
  pg_dump --dbname="$BACKUP_DATABASE_URL" \
    --data-only --quote-all-identifiers \
    --exclude-schema="$platform|storage" \
    --exclude-table-data='"auth"."schema_migrations"' \
    --exclude-table-data='"cron"."job"' \
    --exclude-table-data='"cron"."job_run_details"' \
    --exclude-table-data='"net"."_http_response"' \
    --exclude-table-data='"net"."http_request_queue"' \
    --exclude-table-data='"public"."dev_sms_outbox"' \
    | sed -E 's/^\\(un)?restrict .*$/-- &/'
  echo 'RESET ALL;'

  # Scheduled jobs: Supabase doesn't allow writing cron.job rows directly (not even as postgres),
  # so they're saved as cron.schedule() calls, which recreate them with the same name, schedule
  # and command. Paused jobs are paused again.
  echo '-- Scheduled jobs (pg_cron)'
  psql "$BACKUP_DATABASE_URL" --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
    select case when jobname is null
             then format('select cron.schedule(%L, %L);', schedule, command)
             else format('select cron.schedule(%L, %L, %L);', jobname, schedule, command)
           end
           || case when active then '' else format(
                E'\nselect cron.alter_job(jobid, active := false) from cron.job where jobname = %L and command = %L;',
                jobname, command)
              end
    from cron.job
    order by jobid"
} > "$out/data.sql"

# ── Rows per table ── (COPY blocks: one line per row, ended by "\.")
awk '
  /^COPY / { table = $2; rows = 0; inside = 1; next }
  inside && /^\\\.$/ { print table "\t" rows; inside = 0; next }
  inside { rows++ }
' "$out/data.sql" > "$out/counts.tsv"

# ── Sanity checks ── (a dump that "succeeds" but is empty is the worst kind of backup)
grep -q '^CREATE TABLE IF NOT EXISTS "public"."landlords"' "$out/schema.sql" || { echo 'schema.sql has no public.landlords table' >&2; exit 1; }
grep -q '^"public"."landlords"' "$out/counts.tsv" || { echo 'data.sql has no public.landlords data' >&2; exit 1; }
grep -q '^"auth"."users"' "$out/counts.tsv" || { echo 'data.sql has no auth.users data' >&2; exit 1; }
grep -q '^select cron.schedule(' "$out/data.sql" || { echo 'data.sql has no scheduled jobs' >&2; exit 1; }

# Table count only: sizes would hint at how much data RentPadi holds, in a public log.
echo "Dumped $(wc -l < "$out/counts.tsv" | tr -d ' ') tables."
