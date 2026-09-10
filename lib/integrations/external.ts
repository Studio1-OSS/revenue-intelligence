import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { database, requireOwner, rows, stableId } from "../db";
import { encryptKey, decryptKey } from "../crypto";
import { AppError } from "../errors";
import { chunkText } from "../ingest";
import type { WorkspaceContext } from "../types";
import {
  fetchSourcePage,
  resourceKey,
  sourceConfig,
  sourceSetup,
} from "./external-providers";
import type { z } from "zod";

type StoredConnection = {
  id: string;
  workspace_id: string;
  provider: string;
  resource: string;
  config: string;
  token_ciphertext: string;
  revision: string;
  cursor: string | null;
  enabled: number;
};
export async function externalStatus(ctx: WorkspaceContext, db = database()) {
  const values = await rows<{
    id: string;
    config: string;
    enabled: number;
    hasToken: number;
    hasMore: number;
    lastSyncedAt: string | null;
    documents: number;
  }>(
    `SELECT c.id,c.config,c.enabled,(c.token_ciphertext!='') AS hasToken,(c.cursor IS NOT NULL) AS hasMore,c.last_synced_at AS lastSyncedAt,
      (SELECT COUNT(*) FROM external_records r WHERE r.connection_id=c.id AND r.workspace_id=c.workspace_id) AS documents
      FROM external_connections c WHERE c.workspace_id=? ORDER BY c.created_at`,
    [ctx.workspaceId],
    db,
  );
  return values.map((value) => ({
    ...value,
    config: sourceConfig.parse(JSON.parse(value.config)),
    enabled: Boolean(value.enabled),
    hasToken: Boolean(value.hasToken),
    hasMore: Boolean(value.hasMore),
  }));
}

export async function connectExternal(
  ctx: WorkspaceContext,
  input: z.infer<typeof sourceSetup>,
  db = database(),
  transport: typeof fetch = fetch,
) {
  requireOwner(ctx);
  const { config, token } = sourceSetup.parse(input);
  const resource = resourceKey(config);
  const serialized = JSON.stringify(config);
  const [existing] = await rows<StoredConnection>(
    "SELECT * FROM external_connections WHERE workspace_id=? AND provider=? AND resource=?",
    [ctx.workspaceId, config.provider, resource],
    db,
  );
  if (existing?.enabled)
    throw new AppError(
      "ALREADY_CONNECTED",
      "This source is already connected. Disconnect it before replacing its token.",
      409,
    );
  if (existing && existing.config !== serialized)
    throw new AppError(
      "MAPPING_CHANGED",
      "Reconnect with the original account mapping. This prototype does not move imported evidence between accounts.",
      409,
    );
  // Verify read access, but do not persist source data or run AI during setup.
  await fetchSourcePage(config, token, null, transport);
  const id = existing?.id || randomUUID();
  const ciphertext = token
    ? encryptKey(token, ctx.workspaceId, undefined, `source:${id}`)
    : "";
  const tx = await db.transaction("write");
  try {
    const count = await tx.execute({
      sql: "SELECT COUNT(*) AS n FROM external_connections WHERE workspace_id=?",
      args: [ctx.workspaceId],
    });
    if (!existing && Number(count.rows[0].n) >= 5)
      throw new AppError(
        "CONNECTION_LIMIT",
        "The prototype supports five saved GitHub/Airtable sources per workspace.",
        409,
      );
    const inserted = await tx.execute({
      sql: `INSERT INTO external_connections(id,workspace_id,provider,resource,config,token_ciphertext,revision,created_at) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(workspace_id,provider,resource) DO UPDATE SET token_ciphertext=excluded.token_ciphertext,revision=excluded.revision,enabled=1,cursor=NULL,last_synced_at=NULL
        WHERE external_connections.enabled=0 AND external_connections.id=excluded.id AND external_connections.config=excluded.config`,
      args: [
        id,
        ctx.workspaceId,
        config.provider,
        resource,
        serialized,
        ciphertext,
        randomUUID(),
        new Date().toISOString(),
      ],
    });
    if (!inserted.rowsAffected)
      throw new AppError(
        "CONNECTION_CHANGED",
        "Connection settings changed. Refresh and retry.",
        409,
      );
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
  return { connections: await externalStatus(ctx, db) };
}

export async function disconnectExternal(
  ctx: WorkspaceContext,
  id: string,
  db = database(),
) {
  requireOwner(ctx);
  const result = await db.execute({
    sql: "UPDATE external_connections SET enabled=0,token_ciphertext='',revision=? WHERE id=? AND workspace_id=?",
    args: [randomUUID(), id, ctx.workspaceId],
  });
  if (!result.rowsAffected)
    throw new AppError("NOT_FOUND", "Connection not found.", 404);
}

export async function syncExternal(
  ctx: WorkspaceContext,
  id: string,
  db = database(),
  transport: typeof fetch = fetch,
) {
  requireOwner(ctx);
  const [connection] = await rows<StoredConnection>(
    "SELECT * FROM external_connections WHERE id=? AND workspace_id=? AND enabled=1",
    [id, ctx.workspaceId],
    db,
  );
  if (!connection)
    throw new AppError(
      "NOT_FOUND",
      "Connection not found or disconnected.",
      404,
    );
  const lease = randomUUID(),
    now = Date.now();
  const lock = await db.execute({
    sql: "INSERT INTO workspace_jobs(workspace_id,lease_id,expires_at) VALUES(?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET lease_id=excluded.lease_id,expires_at=excluded.expires_at WHERE workspace_jobs.expires_at<? RETURNING lease_id",
    args: [ctx.workspaceId, lease, now + 300_000, now],
  });
  if (!lock.rows.length)
    throw new AppError(
      "PROCESSING_ACTIVE",
      "A sync or AI processing job is active. Wait for it to finish.",
      409,
    );
  try {
    const config = sourceConfig.parse(JSON.parse(connection.config));
    const token = connection.token_ciphertext
      ? decryptKey(
          connection.token_ciphertext,
          ctx.workspaceId,
          undefined,
          `source:${id}`,
        )
      : "";
    const page = await fetchSourcePage(
      config,
      token,
      connection.cursor,
      transport,
    );
    const tx = await db.transaction("write");
    let imported = 0,
      updated = 0,
      unchanged = 0;
    try {
      const active = await tx.execute({
        sql: "SELECT c.id FROM external_connections c JOIN workspace_jobs j ON j.workspace_id=c.workspace_id WHERE c.id=? AND c.workspace_id=? AND c.enabled=1 AND c.revision=? AND j.lease_id=? AND j.expires_at>?",
        args: [id, ctx.workspaceId, connection.revision, lease, Date.now()],
      });
      if (!active.rows.length)
        throw new AppError(
          "CONNECTION_CHANGED",
          "The connection changed during sync. Refresh and retry.",
          409,
        );
      const count = await tx.execute({
        sql: "SELECT COUNT(*) AS n FROM documents WHERE workspace_id=?",
        args: [ctx.workspaceId],
      });
      let total = Number(count.rows[0].n);
      const sourceId = stableId("src", id);
      const timestamp = new Date().toISOString();
      await tx.execute({
        sql: "INSERT INTO sources(id,workspace_id,name,kind,created_at) VALUES(?,?,?,'manual',?) ON CONFLICT(id) DO NOTHING",
        args: [
          sourceId,
          ctx.workspaceId,
          `${config.provider === "github" ? "GitHub" : "Airtable"}: ${connection.resource}`.slice(
            0,
            120,
          ),
          timestamp,
        ],
      });
      for (const item of page.items) {
        const hash = createHash("sha256")
          .update(JSON.stringify(item.document))
          .digest("hex");
        const previous = await tx.execute({
          sql: "SELECT document_id,content_hash FROM external_records WHERE workspace_id=? AND connection_id=? AND external_id=?",
          args: [ctx.workspaceId, id, item.id],
        });
        if (previous.rows[0]?.content_hash === hash) {
          unchanged++;
          continue;
        }
        const documentId = previous.rows.length
          ? String(previous.rows[0].document_id)
          : randomUUID();
        if (!previous.rows.length && ++total > 500)
          throw new AppError(
            "WORKSPACE_LIMIT",
            "The workspace has reached its 500-document limit. No changes from this batch were saved.",
            409,
          );
        const doc = item.document;
        const companyId = stableId("co", `${ctx.workspaceId}:${doc.domain}`);
        await tx.execute({
          sql: "INSERT INTO companies(id,workspace_id,domain,name) VALUES(?,?,?,?) ON CONFLICT(workspace_id,domain) DO NOTHING",
          args: [companyId, ctx.workspaceId, doc.domain, doc.company],
        });
        if (previous.rows.length) {
          // Replacing chunks cascades obsolete vectors/signals before reprocessing.
          await tx.execute({
            sql: "DELETE FROM chunks WHERE document_id=? AND workspace_id=?",
            args: [documentId, ctx.workspaceId],
          });
          await tx.execute({
            sql: "UPDATE documents SET company_id=?,title=?,body=? WHERE id=? AND workspace_id=?",
            args: [companyId, doc.title, doc.body, documentId, ctx.workspaceId],
          });
          updated++;
        } else {
          await tx.execute({
            sql: "INSERT INTO documents(id,workspace_id,company_id,source_id,title,body,created_at) VALUES(?,?,?,?,?,?,?)",
            args: [
              documentId,
              ctx.workspaceId,
              companyId,
              sourceId,
              doc.title,
              doc.body,
              timestamp,
            ],
          });
          imported++;
        }
        await tx.batch(
          chunkText(doc.body).map((body, ordinal) => ({
            sql: "INSERT INTO chunks(id,workspace_id,document_id,ordinal,body) VALUES(?,?,?,?,?)",
            args: [randomUUID(), ctx.workspaceId, documentId, ordinal, body],
          })),
        );
        await tx.execute({
          sql: "INSERT INTO external_records(workspace_id,connection_id,external_id,document_id,content_hash,source_url) VALUES(?,?,?,?,?,?) ON CONFLICT(connection_id,external_id) DO UPDATE SET content_hash=excluded.content_hash,source_url=excluded.source_url",
          args: [ctx.workspaceId, id, item.id, documentId, hash, item.url],
        });
      }
      await tx.execute({
        sql: "UPDATE external_connections SET cursor=?,last_synced_at=? WHERE id=? AND workspace_id=?",
        args: [page.nextCursor, timestamp, id, ctx.workspaceId],
      });
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
    return {
      imported,
      updated,
      unchanged,
      skipped: page.skipped,
      truncated: page.truncated,
      hasMore: page.nextCursor !== null,
    };
  } finally {
    await db.execute({
      sql: "DELETE FROM workspace_jobs WHERE workspace_id=? AND lease_id=?",
      args: [ctx.workspaceId, lease],
    });
  }
}
