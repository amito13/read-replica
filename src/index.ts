import express from "express";
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { usersTable } from "./db/schema";
const app = express();
const port = 3000;

if (!process.env.DATABASE_URL || !process.env.READ_DATABASE_URL) {
  throw new Error("DATABASE_URL and READ_DATABASE_URL must be set");
}

const primaryPool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, statement_timeout: 3000 });
const replicaPool = new Pool({ connectionString: process.env.READ_DATABASE_URL, connectionTimeoutMillis: 3000, statement_timeout: 3000 });
const db = drizzle(primaryPool);
const replicaDb = drizzle(replicaPool);

// Initialize each independent database without copying any records.
const createUsersTable = sql`
  CREATE TABLE IF NOT EXISTS users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name varchar(255) NOT NULL
  )
`;
await db.execute(createUsersTable);
await replicaDb.execute(createUsersTable);

app.use(express.json());

app.post("/user-primary", async (req, res) => {
  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim() || Array.from(name.trim()).length > 255) {
    res.status(400).json({ error: "name must be a nonempty string of at most 255 characters" });
    return;
  }

  const [user] = await db.insert(usersTable).values({ name: name.trim() }).returning();
  res.status(201).json({ source: "primary", user });
});

app.get("/user-replica", async (_req, res) => {
  const users = await replicaDb.select().from(usersTable).orderBy(usersTable.id);
  res.json({ source: "replica", users });
});

app.get("/user-primary", async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.id);
  res.json({ source: "primary", users });
});

app.post("/sync-primary-replica", async (_req, res) => {
  const client = await replicaPool.connect();
  try {
    await client.query("BEGIN");
    // Serialize sync requests before taking the primary snapshot.
    await client.query("SELECT pg_advisory_xact_lock(30003000)");
    const users = await db.select().from(usersTable).orderBy(usersTable.id);

    // Replace the replica snapshot atomically, including primary deletions.
    await client.query("DELETE FROM users");
    await client.query(
      `INSERT INTO users (id, name) OVERRIDING SYSTEM VALUE
       SELECT id, name FROM jsonb_to_recordset($1::jsonb) AS u(id integer, name text)`,
      [JSON.stringify(users)],
    );
    await client.query("COMMIT");
    res.json({ synced: true, usersSynced: users.length });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const invalidJson = error instanceof SyntaxError && "status" in error && error.status === 400;
  res.status(invalidJson ? 400 : 500).json({ error: invalidJson ? "Invalid JSON body" : "Request failed" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
