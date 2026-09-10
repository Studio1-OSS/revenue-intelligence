import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { DIMENSIONS } from "../lib/ai/models";

test("Qwen migration preserves tenant evidence, keys and resolved signals while queuing only completed legacy chunks", async () => {
  const db = createClient({ url: "file::memory:" });
  const migration = async (name: string) =>
    db.executeMultiple(
      await readFile(
        new URL(`../db/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  try {
    await migration("001_initial.sql");
    await migration("002_health_triggers.sql");
    for (const tenant of ["one", "two"]) {
      await db.execute({
        sql: "INSERT INTO users(id,auth0_sub,email,name) VALUES(?,?,?,?)",
        args: [tenant, tenant, `${tenant}@example.com`, tenant],
      });
      await db.execute({
        sql: "INSERT INTO workspaces(id,name) VALUES(?,?)",
        args: [tenant, tenant],
      });
      await db.execute({
        sql: "INSERT INTO companies(id,workspace_id,domain,name) VALUES(?,?,?,?)",
        args: [tenant, tenant, `${tenant}.example`, tenant],
      });
      await db.execute({
        sql: "INSERT INTO sources(id,workspace_id,name,kind,created_at) VALUES(?,?,?,'manual','now')",
        args: [tenant, tenant, tenant],
      });
      await db.execute({
        sql: "INSERT INTO documents(id,workspace_id,company_id,source_id,title,body,created_at) VALUES(?,?,?,?,?,'Evidence preserved','now')",
        args: [tenant, tenant, tenant, tenant, tenant],
      });
      await db.execute({
        sql: "INSERT INTO ai_provider_keys VALUES(?,'encrypted','hint','legacy-model','now',?)",
        args: [tenant, tenant],
      });
      for (const [i, status] of ["ready", "pending", "failed"].entries()) {
        const id = `${tenant}-${i}`;
        await db.execute({
          sql: "INSERT INTO chunks(id,workspace_id,document_id,ordinal,body,status) VALUES(?,?,?,?,'Evidence preserved',?)",
          args: [id, tenant, tenant, i, status],
        });
        await db.execute({
          sql: "INSERT INTO chunk_embeddings(workspace_id,chunk_id,model,embedding) VALUES(?,?,'BAAI/bge-en-icl',vector32(?))",
          args: [
            tenant,
            id,
            JSON.stringify(
              Array.from({ length: DIMENSIONS }, (_, j) => (j === 0 ? 1 : 0)),
            ),
          ],
        });
      }
      await db.execute({
        sql: "INSERT INTO signals(id,workspace_id,company_id,chunk_id,kind,title,detail,quote,confidence,status,created_at) VALUES(?,?,?,?,'risk','Title','Detail','Evidence preserved',90,'resolved','now')",
        args: [tenant, tenant, tenant, `${tenant}-0`],
      });
    }
    const signals = (await db.execute("SELECT * FROM signals ORDER BY id"))
      .rows;
    const documents = (await db.execute("SELECT * FROM documents ORDER BY id"))
      .rows;
    const keys = (
      await db.execute("SELECT * FROM ai_provider_keys ORDER BY workspace_id")
    ).rows;
    await migration("003_qwen_embeddings.sql");
    expect(
      (await db.execute("SELECT * FROM signals ORDER BY id")).rows,
    ).toEqual(signals);
    expect(
      (await db.execute("SELECT * FROM documents ORDER BY id")).rows,
    ).toEqual(documents);
    expect(
      (await db.execute("SELECT * FROM ai_provider_keys ORDER BY workspace_id"))
        .rows,
    ).toEqual(keys);
    expect((await db.execute("SELECT * FROM chunk_embeddings")).rows).toEqual(
      [],
    );
    for (const tenant of ["one", "two"]) {
      const result = await db.execute({
        sql: "SELECT status,classification_complete AS complete FROM chunks WHERE workspace_id=? ORDER BY ordinal",
        args: [tenant],
      });
      expect(
        result.rows.map((row) => ({
          status: row.status,
          complete: row.complete,
        })),
      ).toEqual([
        { status: "pending", complete: 1 },
        { status: "pending", complete: 0 },
        { status: "failed", complete: 0 },
      ]);
    }
    expect(
      (
        await db.execute(
          "SELECT count(*) AS n FROM chunks_fts WHERE chunks_fts MATCH 'preserved'",
        )
      ).rows[0].n,
    ).toBe(6);
  } finally {
    db.close();
  }
});
