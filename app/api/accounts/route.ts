import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { database } from "@/lib/db";
export const PATCH = route(async (request) => {
  const ctx = await context(request, true);
  const { id, arr, owner, renewal } = await jsonBody(
    request,
    z.object({
      id: z.string().max(100),
      arr: z.number().int().min(0).max(1_000_000_000),
      owner: z.string().trim().max(120),
      renewal: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    }),
  );
  const result = await database().execute({
    sql: "UPDATE companies SET arr=?,owner=?,renewal=? WHERE id=? AND workspace_id=?",
    args: [arr, owner, renewal, id, ctx.workspaceId],
  });
  return json({ updated: result.rowsAffected > 0 });
});
