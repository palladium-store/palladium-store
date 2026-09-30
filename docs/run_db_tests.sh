#!/usr/bin/env bash
# Usage: DB=palladium_test bash docs/run_db_tests.sh   (needs psql access to a local Postgres 14+)
set -e
DB=${DB:-palladium_test}
psql -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" postgres
for m in prisma/migrations/*/migration.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f $m; done
psql -v ON_ERROR_STOP=1 -q -t -d $DB -f prisma/tests/workflows.sql | grep -E "PASSED|FAILED|ERROR"
