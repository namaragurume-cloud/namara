#!/usr/bin/env bash
# ローカルの PostgreSQL（16 以上）で、マイグレーションと RLS テストを一時DBに対して実行する。
# 本番・Supabase には接続しない。使い方： PGHOST=... PGUSER=... bash supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="namara_rls_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -o /dev/null -d "$DB" -f tests/rls_test.sql 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  //"
