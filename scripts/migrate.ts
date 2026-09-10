import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Set TURSO_DATABASE_URL before running migrations.");
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  for (const name of (
    await readdir(new URL("../db/migrations/", import.meta.url))
  )
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL(`../db/migrations/${name}`, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = await db.execute({
      sql: "SELECT checksum FROM schema_migrations WHERE name=?",
      args: [name],
    });
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    const tx = await db.transaction("write");
    try {
      await tx.executeMultiple(sql);
      await tx.execute({
        sql: "INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,?)",
        args: [name, checksum, new Date().toISOString()],
      });
      await tx.commit();
      console.log(`Applied ${name}`);
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  }
} finally {
  db.close();
}
