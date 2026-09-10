import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";
import { createHash } from "node:crypto";
import type { WorkspaceContext, Snapshot, SearchHit } from "./types";
import { AppError } from "./errors";
import { productionDeployment } from "./environment";
import { EMBEDDING_MODEL } from "./ai/models";

let client: Client | undefined;
export function database() {
  if (
    (productionDeployment() || process.env.VERCEL) &&
    process.env.TURSO_DATABASE_URL?.startsWith("file:")
  )
    throw new AppError(
      "DATABASE_NOT_CONFIGURED",
      "Hosted storage is required for this deployment.",
      503,
    );
  if (!process.env.TURSO_DATABASE_URL)
    throw new AppError(
      "DATABASE_NOT_CONFIGURED",
      "The workspace database is not configured.",
      503,
    );
  client ??= createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}
export function stableId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}
export function mapIdentity(user: {
  sub?: string;
  email?: string;
  name?: string;
}) {
  if (!user.sub || user.sub.endsWith("@clients"))
    throw new AppError("UNAUTHORIZED", "A user identity is required.", 401);
  return {
    id: stableId("usr", user.sub),
    sub: user.sub,
    email: user.email || "",
    name: user.name || "My workspace",
  };
}
export async function resolveWorkspace(
  user: { sub?: string; email?: string; name?: string },
  selected?: string | null,
  db = database(),
): Promise<WorkspaceContext> {
  const identity = mapIdentity(user);
  const personal = stableId("ws", identity.sub);
  await db.batch(
    [
      {
        sql: "INSERT INTO users(id,auth0_sub,email,name) VALUES(?,?,?,?) ON CONFLICT(auth0_sub) DO NOTHING",
        args: [identity.id, identity.sub, identity.email, identity.name],
      },
      {
        sql: "INSERT OR IGNORE INTO workspaces(id,name) VALUES(?,?)",
        args: [personal, `${identity.name}'s workspace`],
      },
      {
        sql: "INSERT OR IGNORE INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')",
        args: [personal, identity.id],
      },
    ],
    "write",
  );
  const result = await db.execute({
    sql: "SELECT m.role,w.name FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.workspace_id=?",
    args: [identity.id, selected || personal],
  });
  const member = result.rows[0];
  if (!member)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this workspace.",
      403,
    );
  return {
    userId: identity.id,
    workspaceId: selected || personal,
    role: member.role as "owner" | "member",
    email: identity.email,
    name: identity.name,
    workspaceName: String(member.name),
  };
}
export function requireOwner(ctx: WorkspaceContext) {
  if (ctx.role !== "owner")
    throw new AppError(
      "OWNER_REQUIRED",
      "Only the workspace owner can manage this setting.",
      403,
    );
}
export async function rows<T>(
  sql: string,
  args: InValue[],
  db = database(),
): Promise<T[]> {
  return (await db.execute({ sql, args })).rows as unknown as T[];
}
export async function snapshot(
  ctx: WorkspaceContext,
  db = database(),
): Promise<Snapshot> {
  const w = ctx.workspaceId;
  const [
    accounts,
    signals,
    evidence,
    competitors,
    savedQueries,
    key,
    pending,
    usage,
  ] = await Promise.all([
    rows<Snapshot["accounts"][number]>(
      `SELECT c.id,c.domain,c.name,c.arr,c.owner,c.renewal,c.health,COUNT(d.id) AS evidenceCount FROM companies c LEFT JOIN documents d ON d.company_id=c.id AND d.workspace_id=c.workspace_id WHERE c.workspace_id=? GROUP BY c.id ORDER BY c.health,c.name`,
      [w],
      db,
    ),
    rows<Snapshot["signals"][number]>(
      `SELECT s.id,s.company_id AS companyId,c.name AS company,c.domain,s.kind,s.title,s.detail,s.confidence,s.status,s.quote,s.chunk_id AS chunkId,s.created_at AS createdAt FROM signals s JOIN companies c ON c.id=s.company_id AND c.workspace_id=s.workspace_id WHERE s.workspace_id=? ORDER BY s.created_at DESC LIMIT 500`,
      [w],
      db,
    ),
    rows<Snapshot["evidence"][number]>(
      `SELECT d.id,d.title,d.body,c.domain,c.name AS company,s.name AS source,d.created_at AS createdAt,CASE WHEN EXISTS(SELECT 1 FROM chunks k WHERE k.document_id=d.id AND k.status='failed') THEN 'failed' WHEN EXISTS(SELECT 1 FROM chunks k WHERE k.document_id=d.id AND k.status='pending') THEN 'pending' ELSE 'ready' END AS status FROM documents d JOIN companies c ON c.id=d.company_id AND c.workspace_id=d.workspace_id JOIN sources s ON s.id=d.source_id AND s.workspace_id=d.workspace_id WHERE d.workspace_id=? ORDER BY d.created_at DESC LIMIT 500`,
      [w],
      db,
    ),
    rows<Snapshot["competitors"][number]>(
      "SELECT name,COUNT(*) AS mentions,COUNT(DISTINCT company_id) AS accounts,MAX(quote) AS evidence FROM competitors WHERE workspace_id=? GROUP BY name ORDER BY mentions DESC",
      [w],
      db,
    ),
    rows<Snapshot["savedQueries"][number]>(
      "SELECT id,title,query,share_token AS shareToken FROM saved_queries WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100",
      [w],
      db,
    ),
    rows<NonNullable<Snapshot["key"]>>(
      "SELECT hint,verified_at AS verifiedAt,model FROM ai_provider_keys WHERE workspace_id=?",
      [w],
      db,
    ),
    rows<{ count: number }>(
      "SELECT COUNT(*) AS count FROM chunks WHERE workspace_id=? AND status!='ready'",
      [w],
      db,
    ),
    rows<{ count: number }>(
      "SELECT COALESCE(SUM(tokens),0) AS count FROM usage_events WHERE workspace_id=?",
      [w],
      db,
    ),
  ]);
  return {
    accounts,
    signals,
    evidence,
    competitors,
    savedQueries,
    key: key[0] || null,
    pending: pending[0].count,
    usage: usage[0].count,
  };
}
export async function rateLimit(
  ctx: WorkspaceContext,
  operation: string,
  limit = 20,
  seconds = 60,
  db = database(),
) {
  const window = Math.floor(Date.now() / (seconds * 1000));
  const result = await db.execute({
    sql: `INSERT INTO rate_limits(bucket,window,count) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count`,
    args: [`${ctx.workspaceId}:${operation}`, window],
  });
  if (Number(result.rows[0].count) > limit)
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please try again shortly.",
      429,
    );
}
export async function searchChunks(
  workspaceId: string,
  query: string,
  vector: number[],
  domain?: string,
  db = database(),
): Promise<SearchHit[]> {
  const terms =
    query
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 16)
      .map((t) => `"${t}"`)
      .join(" OR ") || '""';
  const scoped = domain ? " AND co.domain=?" : "";
  const scopeArgs: InValue[] = domain ? [workspaceId, domain] : [workspaceId];
  const select = "SELECT c.id,d.title,c.body,co.domain";
  const joins =
    " FROM chunks c JOIN documents d ON d.id=c.document_id AND d.workspace_id=c.workspace_id JOIN companies co ON co.id=d.company_id AND co.workspace_id=d.workspace_id";
  const [lexical, semantic] = await Promise.all([
    rows<SearchHit>(
      `${select},bm25(chunks_fts) AS score${joins} JOIN chunks_fts ON chunks_fts.rowid=c.rowid WHERE c.workspace_id=?${scoped} AND chunks_fts MATCH ? ORDER BY score LIMIT 12`,
      [...scopeArgs, terms],
      db,
    ),
    // Filter the tenant before ranking. Global ANN top-k would starve small workspaces.
    rows<SearchHit>(
      `${select},vector_distance_cos(e.embedding,vector32(?)) AS score${joins} JOIN chunk_embeddings e ON e.chunk_id=c.id AND e.workspace_id=c.workspace_id WHERE c.workspace_id=?${scoped} AND e.model=? ORDER BY score LIMIT 12`,
      [JSON.stringify(vector), ...scopeArgs, EMBEDDING_MODEL],
      db,
    ),
  ]);
  const ranks = new Map<string, SearchHit>();
  for (const list of [lexical, semantic])
    list.forEach((hit, index) => {
      const previous = ranks.get(hit.id);
      ranks.set(hit.id, {
        ...hit,
        score: (previous?.score || 0) + 1 / (60 + index + 1),
      });
    });
  return [...ranks.values()].sort((a, b) => b.score - a.score).slice(0, 8);
}
