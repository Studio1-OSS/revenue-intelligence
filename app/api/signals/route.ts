import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { database } from "@/lib/db";
export const PATCH = route(async (request) => {
  const ctx = await context(request, true);
  const { id, status } = await jsonBody(
    request,
    z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved"]) }),
  );
  const result = await database().execute({
    sql: "UPDATE signals SET status=? WHERE id=? AND workspace_id=?",
    args: [status, id, ctx.workspaceId],
  });
  return json({ updated: result.rowsAffected > 0 });
});
