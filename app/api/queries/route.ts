import { z } from "zod";
import { randomUUID, randomBytes } from "node:crypto";
import { context, json, jsonBody, route } from "@/lib/http";
import { database, rateLimit } from "@/lib/db";
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "queries", 10);
  const { query, title } = await jsonBody(
    request,
    z.object({
      query: z.string().trim().min(2).max(2000),
      title: z.string().trim().min(1).max(100),
    }),
  );
  const id = randomUUID();
  await database().execute({
    sql: "INSERT INTO saved_queries(id,workspace_id,user_id,title,query,created_at) VALUES(?,?,?,?,?,?)",
    args: [
      id,
      ctx.workspaceId,
      ctx.userId,
      title,
      query,
      new Date().toISOString(),
    ],
  });
  return json({ id }, 201);
});
export const PATCH = route(async (request) => {
  const ctx = await context(request, true);
  const { id, shared } = await jsonBody(
    request,
    z.object({ id: z.string().uuid(), shared: z.boolean() }),
  );
  const token = shared ? randomBytes(24).toString("base64url") : null;
  const result = await database().execute({
    sql: "UPDATE saved_queries SET share_token=? WHERE id=? AND workspace_id=? AND user_id=?",
    args: [token, id, ctx.workspaceId, ctx.userId],
  });
  return json({
    updated: result.rowsAffected > 0,
    shareToken: result.rowsAffected ? token : null,
  });
});
export const DELETE = route(async (request) => {
  const ctx = await context(request, true);
  const { id } = await jsonBody(request, z.object({ id: z.string().uuid() }));
  await database().execute({
    sql: "DELETE FROM saved_queries WHERE id=? AND workspace_id=? AND user_id=?",
    args: [id, ctx.workspaceId, ctx.userId],
  });
  return json({ deleted: true });
});
