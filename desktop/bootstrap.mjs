import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
const data = process.env.POS_DATA_DIR;
if (!data) throw new Error("POS_DATA_DIR is required");
mkdirSync(data, { recursive: true });
const database = join(data, "store.db");
const sql = new DatabaseSync(database);
sql.exec(
  "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;",
);
sql.exec(
  'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, applied_steps_count INTEGER NOT NULL DEFAULT 0)',
);
for (const name of readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()) {
  const migration = readFileSync(
    join("prisma/migrations", name, "migration.sql"),
    "utf8",
  );
  const checksum = createHash("sha256").update(migration).digest("hex");
  const applied = sql
    .prepare(
      "SELECT checksum FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL AND rolled_back_at IS NULL",
    )
    .get(name);
  if (applied) {
    if (applied.checksum !== checksum)
      throw new Error(`Migration checksum mismatch: ${name}`);
    continue;
  }
  // Keep schema changes and migration marker in the same SQLite transaction.
  sql.exec("BEGIN IMMEDIATE");
  try {
    sql.exec(migration);
    sql
      .prepare(
        "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, ?, ?, 1)",
      )
      .run(randomUUID(), checksum, Date.now(), name, Date.now());
    sql.exec("COMMIT");
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  }
}
sql.close();
process.env.DATABASE_URL = "file:" + resolve(database).replaceAll("\\", "/");
process.env.BACKUP_DIR = join(data, "backups");
await import("../dist-server/server/index.js");
