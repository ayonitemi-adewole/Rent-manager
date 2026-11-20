#!/usr/bin/env bash
# Restores a dump into an empty Supabase database and checks that every table got all its rows.
# The nightly backup runs this against a throwaway local Supabase (supabase start), so each
# backup is known to restore, not just to exist.
#
#   RESTORE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#     scripts/backup/restore-check.sh <dump-dir>
#
# <dump-dir> holds schema.sql, data.sql and counts.tsv from dump.sh. Prints table names only,
# never rows or counts: the repo is public, so are the workflow logs.
set -euo pipefail

dir=${1:?usage: restore-check.sh <dump-dir>}
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is not set}"

# One transaction: a restore either fully works or changes nothing.
psql "$RESTORE_DATABASE_URL" --quiet --no-psqlrc --set ON_ERROR_STOP=1 --single-transaction \
  --file "$dir/schema.sql" --file "$dir/data.sql" > /dev/null

checked=0
wrong=()
while IFS=$'\t' read -r table expected; do
  actual=$(psql "$RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "select count(*) from $table")
  [ "$actual" = "$expected" ] || wrong+=("$table")
  checked=$((checked + 1))
done < "$dir/counts.tsv"

if [ ${#wrong[@]} -gt 0 ]; then
  echo "Restore check FAILED: row counts differ in ${wrong[*]}" >&2
  exit 1
fi
echo "Restore check passed: $checked tables restored with every row."
