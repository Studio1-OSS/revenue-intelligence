import { z } from "zod";
import { context, json, jsonBody, readBody, route } from "@/lib/http";
import { documentInput, ingest, parseCSV } from "@/lib/ingest";
import { database, rateLimit, requireOwner } from "@/lib/db";
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "uploads", 10);
  const csv = request.headers.get("content-type")?.includes("text/csv");
  const input = csv
    ? parseCSV(await readBody(request))
    : [await jsonBody(request, documentInput, 100_000)];
  const result = await ingest(
    ctx,
    input,
    csv ? "CSV import" : "Manual notes",
    csv ? "csv" : "manual",
  );
  return json(result, 201);
});
export const DELETE = route(async (request) => {
  const ctx = await context(request, true);
  requireOwner(ctx);
  const { id } = await jsonBody(request, z.object({ id: z.string().uuid() }));
  const result = await database().execute({
    sql: "DELETE FROM documents WHERE id=? AND workspace_id=?",
    args: [id, ctx.workspaceId],
  });
  return json({ deleted: result.rowsAffected > 0 });
});
