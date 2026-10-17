#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$PGDATA"
chown postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  # Retry the initial copy without leaving a partial backup in the data volume.
  until gosu postgres pg_basebackup \
    --host=postgres-primary \
    --username=replicator \
    --pgdata="$PGDATA" \
    --wal-method=stream \
    --write-recovery-conf \
    --no-password; do
    echo 'Waiting to copy the primary database...'
    sleep 3
  done
fi

exec /usr/local/bin/docker-entrypoint.sh postgres -c hot_standby=on
