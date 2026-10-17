# read-replica

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run run
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Manual primary-to-replica experiment

```bash
docker compose up -d --wait
bun run run
```

The primary runs on port 5432 and the second database on port 5433, using the
connection strings in `.env`. These are independent PostgreSQL databases:
there is no automatic streaming replication. Passwords are for local use only.
The second database uses a new `replica-manual-data` volume; the old streaming
replica volume is preserved but is no longer attached.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | `/user-primary` | Insert `{ "name": "Amit" }` into the primary only |
| GET | `/user-primary` | Read users from the primary |
| GET | `/user-replica` | Read the last manually synced users |
| POST | `/sync-primary-replica` | Replace the second database's users with a primary snapshot |
| GET | `/health` | Check the API is running |

```bash
curl -X POST localhost:3000/user-primary -H 'Content-Type: application/json' -d '{"name":"Amit"}'
curl localhost:3000/user-primary
curl localhost:3000/user-replica
curl -X POST localhost:3000/sync-primary-replica
curl localhost:3000/user-replica
```

Sync copies only the `users` table, including IDs, names, updates, and deletions.
It replaces the replica records atomically; a failed copy rolls back. Writes
committed after the primary snapshot need another sync. Direct edits to the
second database will be overwritten by the next sync. It is writable PostgreSQL,
though this API exposes only reads from it.

Open Studio in separate terminals:

```bash
bun run studio:primary
bun run studio:replica
```

Primary: https://local.drizzle.studio

Replica: https://local.drizzle.studio?port=4984

Refresh the Studio table after syncing. Stop containers with `docker compose down`
to preserve the attached volumes. The old `/user` and `/syncdb` routes are removed.
