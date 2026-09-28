import { z } from "zod";
import { context, json, jsonBody, readBody, route } from "@/lib/http";
import { documentInput, ingest, parseCSV } from "@/lib/ingest";
import { database, rateLimit, requireOwner } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  extractVisualEvidence,
  parseVisualFields,
  validateVisualFile,
} from "@/lib/ai/visual-evidence";
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "uploads", 10);
  const contentType = request.headers.get("content-type") || "";
  const csv = contentType.includes("text/csv");
  const multipart = contentType.includes("multipart/form-data");
  if (multipart) {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File))
      throw new AppError("INVALID_INPUT", "Choose an image file.", 400);
    const mimeType = validateVisualFile(image);
    const document = await extractVisualEvidence(ctx, {
      ...parseVisualFields(Object.fromEntries(form.entries())),
      fileName: image.name.slice(0, 180) || "visual-evidence",
      mimeType,
      data: Buffer.from(await image.arrayBuffer()),
    });
    const result = await ingest(
      ctx,
      [document],
      `Visual evidence: ${image.name || "image"}`,
      "manual",
    );
    return json({ ...result, extracted: true }, 201);
  }
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
