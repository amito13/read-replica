#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replication_password';
SQL

echo 'host replication replicator all scram-sha-256' >> "$PGDATA/pg_hba.conf"
