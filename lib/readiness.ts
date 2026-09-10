import type { Client } from "@libsql/client";

export const requiredMigrations = [
  "001_initial.sql",
  "002_health_triggers.sql",
  "003_qwen_embeddings.sql",
  "004_tally_integration.sql",
  "005_external_sources.sql",
];

export async function checkDatabaseReadiness(db: Client) {
  const migrations = await db.execute("SELECT name FROM schema_migrations");
  const applied = new Set(migrations.rows.map((row) => String(row.name)));
  if (requiredMigrations.some((name) => !applied.has(name)))
    throw new Error("MIGRATIONS_PENDING");
  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE name IN ('users','workspace_members','ai_provider_keys','chunks_fts','chunk_embeddings','workspace_jobs','tally_connections','tally_receipts','external_connections','external_records')",
  );
  if (tables.rows.length !== 10) throw new Error("SCHEMA_INCOMPLETE");
  const result = await db.execute(
    "SELECT vector_distance_cos(vector32('[1,0]'),vector32('[1,0]')) AS distance",
  );
  if (Number(result.rows[0]?.distance) !== 0)
    throw new Error("VECTORS_UNAVAILABLE");
  await db.execute(
    "SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH 'readiness_probe' LIMIT 0",
  );
}
